// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  findNativeRecentsTitle,
  installNativeTitleAutoHideOverride,
  installNativeTitleColorMirror,
  installNativeTitleOpacityMirror,
  installRecentsTitleFade,
} from "../../core/recentsTitleFade";

describe("Recent Games title fade", () => {
  it("fades on a Deck Shelves focus handoff and restores on native focus", () => {
    const parent = document.createElement("main");
    const recents = document.createElement("section");
    const title = document.createElement("h2");
    title.textContent = "Recent Games";
    const nativeCard = document.createElement("button");
    nativeCard.setAttribute("aria-label", "A native game");
    recents.append(title, nativeCard);

    const mount = document.createElement("div");
    mount.id = "deck-shelves-home-root";
    const shelfCard = document.createElement("button");
    shelfCard.className = "ds-card";
    mount.appendChild(shelfCard);
    parent.append(recents, mount);
    document.body.appendChild(parent);

    expect(findNativeRecentsTitle(mount)).toBe(title);
    const uninstall = installRecentsTitleFade(mount);

    shelfCard.focus();
    expect(title.getAttribute("data-ds-recents-title-faded")).toBe("true");
    nativeCard.focus();
    expect(title.hasAttribute("data-ds-recents-title-faded")).toBe(false);

    uninstall();
    parent.remove();
  });

  it("tracks Steam gamepad focus class changes in a foreign Steam document", async () => {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const steamDocument = frame.contentDocument!;
    const parent = steamDocument.createElement("main");
    const recents = steamDocument.createElement("section");
    const title = steamDocument.createElement("h2");
    title.textContent = "Recent Games";
    const nativeCard = steamDocument.createElement("button");
    recents.append(title, nativeCard);

    const mount = steamDocument.createElement("div");
    mount.id = "deck-shelves-home-root";
    const shelfCard = steamDocument.createElement("button");
    shelfCard.className = "ds-card";
    mount.appendChild(shelfCard);
    parent.append(recents, mount);
    steamDocument.body.appendChild(parent);

    const uninstall = installRecentsTitleFade(mount);
    shelfCard.classList.add("gpfocus");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(title.getAttribute("data-ds-recents-title-faded")).toBe("true");

    shelfCard.classList.remove("gpfocus");
    nativeCard.classList.add("gpfocus");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(title.hasAttribute("data-ds-recents-title-faded")).toBe(false);

    uninstall();
    frame.remove();
  });

  it("samples the native label instead of its opaque heading wrapper", () => {
    const parent = document.createElement("main");
    const recents = document.createElement("section");
    const heading = document.createElement("div");
    heading.setAttribute("role", "heading");
    const title = document.createElement("div");
    title.textContent = "Recent Games";
    title.style.opacity = "0.7";
    heading.append(title, document.createElement("div"));
    recents.append(heading, document.createElement("div"));

    const mount = document.createElement("div");
    mount.id = "deck-shelves-home-root";
    const root = document.createElement("div");
    root.className = "deck-shelves-root";
    mount.append(root);
    parent.append(recents, mount);
    document.body.append(parent);

    expect(findNativeRecentsTitle(mount)).toBe(title);
    const uninstall = installNativeTitleOpacityMirror(mount, root);
    expect(root.style.getPropertyValue("--ds-native-title-opacity")).toBe("0.7");

    uninstall();
    expect(root.style.getPropertyValue("--ds-native-title-opacity")).toBe("");
    parent.remove();
  });

  it("mirrors grayscale theme colors and reacts to live title changes", async () => {
    const parent = document.createElement("main");
    const recents = document.createElement("section");
    const title = document.createElement("h2");
    title.textContent = "Recent Games";
    title.style.color = "rgb(24, 24, 24)";
    recents.append(title, document.createElement("div"));

    const mount = document.createElement("div");
    mount.id = "deck-shelves-home-root";
    const root = document.createElement("div");
    root.className = "deck-shelves-root";
    const shelfTitle = document.createElement("div");
    shelfTitle.className = "ds-shelf-title themed-shelf-title";
    root.append(shelfTitle);
    mount.append(root);
    parent.append(recents, mount);
    const themeStyle = document.createElement("style");
    themeStyle.textContent = `
      .themed-shelf-title {
        color: rgb(166, 173, 200) !important;
      }
    `;
    document.head.append(themeStyle);
    document.body.append(parent);

    const uninstall = installNativeTitleColorMirror(mount, root);
    expect(root.style.getPropertyValue("--ds-native-heading-color")).toBe("rgb(24, 24, 24)");
    expect(getComputedStyle(shelfTitle).color).toBe("rgb(24, 24, 24)");

    title.style.color = "rgb(220, 220, 220)";
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.style.getPropertyValue("--ds-native-heading-color")).toBe("rgb(220, 220, 220)");
    expect(getComputedStyle(shelfTitle).color).toBe("rgb(220, 220, 220)");

    uninstall();
    expect(root.style.getPropertyValue("--ds-native-heading-color")).toBe("");
    expect(shelfTitle.style.getPropertyValue("color")).toBe("");
    themeStyle.remove();
    parent.remove();
  });

  it("keeps the native title visible when shared auto-hide is disabled", () => {
    const parent = document.createElement("main");
    const recents = document.createElement("section");
    const title = document.createElement("h2");
    title.textContent = "Recent Games";
    title.style.opacity = "0";
    recents.append(title, document.createElement("div"));
    const mount = document.createElement("div");
    mount.id = "deck-shelves-home-root";
    const root = document.createElement("div");
    root.className = "deck-shelves-root";
    root.style.setProperty("--ds-native-title-opacity", "0.65");
    mount.append(root);
    parent.append(recents, mount);
    document.body.append(parent);

    const uninstall = installNativeTitleAutoHideOverride(mount, root);
    expect(title.dataset.dsNativeTitleAutoHideDisabled).toBe("true");
    expect(title.style.getPropertyValue("--ds-native-title-visible-opacity")).toBe("0.65");

    uninstall();
    expect(title.hasAttribute("data-ds-native-title-auto-hide-disabled")).toBe(false);
    expect(title.style.getPropertyValue("--ds-native-title-visible-opacity")).toBe("");
    parent.remove();
  });
});

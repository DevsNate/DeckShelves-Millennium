// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findNativeRecentsTitle, installRecentsTitleFade } from "../../core/recentsTitleFade";

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
});

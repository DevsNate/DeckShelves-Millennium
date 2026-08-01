// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installShelfTitleAutoHide,
  NATIVE_SHELF_TITLE_VISIBLE_MS,
} from "../../components/shelf/shelfTitleBehavior";

describe("native shelf-title auto hide", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("uses Steam's eight-second focus window and cleans up its state", () => {
    vi.useFakeTimers();
    const title = document.createElement("div");
    const row = document.createElement("div");
    const card = document.createElement("div");
    card.className = "ds-card";
    row.append(card);
    document.body.append(title, row);

    const cleanup = installShelfTitleAutoHide(title, row);
    expect(title.dataset.dsTitleAutoHide).toBe("true");
    expect(title.dataset.dsTitleVisible).toBe("true");

    vi.advanceTimersByTime(NATIVE_SHELF_TITLE_VISIBLE_MS);
    expect(title.dataset.dsTitleVisible).toBe("false");

    card.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title.dataset.dsTitleVisible).toBe("true");
    vi.advanceTimersByTime(NATIVE_SHELF_TITLE_VISIBLE_MS - 1);
    expect(title.dataset.dsTitleVisible).toBe("true");
    vi.advanceTimersByTime(1);
    expect(title.dataset.dsTitleVisible).toBe("false");

    cleanup();
    expect(title.hasAttribute("data-ds-title-auto-hide")).toBe(false);
    expect(title.hasAttribute("data-ds-title-visible")).toBe(false);
  });

  it("restarts the native timer when pointer focus moves to another card", () => {
    vi.useFakeTimers();
    const title = document.createElement("div");
    const row = document.createElement("div");
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.className = "ds-card";
    second.className = "ds-card";
    row.append(first, second);
    document.body.append(title, row);

    const cleanup = installShelfTitleAutoHide(title, row);
    vi.advanceTimersByTime(NATIVE_SHELF_TITLE_VISIBLE_MS);
    expect(title.dataset.dsTitleVisible).toBe("false");

    first.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(title.dataset.dsTitleVisible).toBe("true");
    vi.advanceTimersByTime(4000);
    second.dispatchEvent(new Event("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(4001);
    expect(title.dataset.dsTitleVisible).toBe("true");

    cleanup();
  });

  it("overrides native-theme opacity rules while preserving visible opacity", () => {
    vi.useFakeTimers();
    const style = document.createElement("style");
    style.textContent = ".native-title { opacity: 0.7 !important; }";
    const title = document.createElement("div");
    title.className = "native-title";
    const row = document.createElement("div");
    document.head.append(style);
    document.body.append(title, row);

    const cleanup = installShelfTitleAutoHide(title, row);
    expect(title.style.getPropertyPriority("opacity")).toBe("important");
    expect(title.style.opacity).toBe("0.7");

    vi.advanceTimersByTime(NATIVE_SHELF_TITLE_VISIBLE_MS);
    expect(title.dataset.dsTitleVisible).toBe("false");
    expect(title.style.getPropertyValue("opacity")).toBe("0");
    expect(title.style.getPropertyPriority("opacity")).toBe("important");

    cleanup();
    expect(title.style.getPropertyValue("opacity")).toBe("");
    expect(title.style.getPropertyValue("transition")).toBe("");
    style.remove();
  });
});

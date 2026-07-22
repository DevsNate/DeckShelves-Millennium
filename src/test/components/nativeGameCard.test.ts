// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { annotateNativeCard, resolveNativeCapsuleFromElement, shouldShowNativeCardAsHovered } from "../../components/shelf/NativeGameCard";
import { installNativeTitleInteractionOwner, setNativeTitlePointerOwner } from "../../core/nativeTitleInteractionOwner";

describe("native capsule discovery", () => {
  it("forces native hover only for Steam's own gamepad focus", () => {
    expect(shouldShowNativeCardAsHovered(true, true, false)).toBe(true);
    expect(shouldShowNativeCardAsHovered(true, false, false)).toBe(false);
    expect(shouldShowNativeCardAsHovered(false, true, false)).toBe(false);
    expect(shouldShowNativeCardAsHovered(true, true, true)).toBe(false);
  });

  it("gives one hovered native card exclusive label ownership across rows", () => {
    const root = document.createElement("div");
    root.id = "deck-shelves-home-root";
    const cards = [document.createElement("div"), document.createElement("div"), document.createElement("div")];
    cards.forEach((card) => {
      card.className = "ds-card--native";
      const shelf = document.createElement("div");
      shelf.className = "ds-shelf";
      shelf.appendChild(card);
      root.appendChild(shelf);
    });
    document.body.appendChild(root);

    setNativeTitlePointerOwner(root, cards[1]);
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBe("true");
    expect(cards[1].dataset.dsHoverSuppressNativeLabel).toBeUndefined();
    expect(cards[2].dataset.dsHoverSuppressNativeLabel).toBe("true");

    setNativeTitlePointerOwner(root, null);
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBeUndefined();
    expect(cards[2].dataset.dsHoverSuppressNativeLabel).toBeUndefined();
    root.remove();
  });

  it("keeps every native title suppressed after a captured drag leaves the cards", () => {
    const root = document.createElement("div");
    root.id = "deck-shelves-home-root";
    const cards = [document.createElement("div"), document.createElement("div")];
    cards.forEach((card) => {
      card.className = "ds-card--native";
      root.appendChild(card);
    });
    document.body.appendChild(root);

    let hit: Element | null = cards[0];
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => hit,
    });
    const pointer = (type: string, buttons: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: 20, clientY: 20, buttons });
      Object.defineProperty(event, "pointerId", { value: 7 });
      document.dispatchEvent(event);
    };

    const uninstall = installNativeTitleInteractionOwner(root);
    pointer("pointermove", 0);
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBeUndefined();
    expect(cards[1].dataset.dsHoverSuppressNativeLabel).toBe("true");

    pointer("pointerdown", 1);
    hit = null;
    pointer("pointermove", 1);
    pointer("pointerup", 0);
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBe("true");
    expect(cards[1].dataset.dsHoverSuppressNativeLabel).toBe("true");

    hit = cards[1];
    pointer("pointermove", 0);
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBe("true");
    expect(cards[1].dataset.dsHoverSuppressNativeLabel).toBeUndefined();

    hit = null;
    pointer("pointermove", 0);
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBe("true");
    expect(cards[1].dataset.dsHoverSuppressNativeLabel).toBeUndefined();

    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBeUndefined();
    expect(cards[1].dataset.dsHoverSuppressNativeLabel).toBeUndefined();

    uninstall();
    expect(cards[0].dataset.dsHoverSuppressNativeLabel).toBeUndefined();
    root.remove();
  });

  it("finds Steam's complete memoized carousel item and measures its label band", () => {
    const element = document.createElement("div");
    const NativeCapsule = () => null;
    const memoType = { $$typeof: Symbol.for("react.memo"), type: NativeCapsule };
    Object.defineProperty(element, "offsetHeight", { value: 258 });
    element.getBoundingClientRect = () => ({ width: 154.8, height: 232.2 } as DOMRect);
    (element as any).__reactFiber$test = {
      memoizedProps: { className: "native-card" },
      return: {
        elementType: memoType,
        memoizedProps: {
          appid: 10,
          bFeatured: false,
          bShortLayout: false,
          nWidth: 172,
          nHeight: 310,
          nCarouselWidth: 1800,
          onItemFocus: () => {},
          onItemHover: () => {},
        },
        return: null,
      },
    };

    const result = resolveNativeCapsuleFromElement(element);
    expect(result?.component).toBe(memoType);
    expect(result?.labelHeight).toBe(52);
  });

  it("rejects unrelated React component fibers", () => {
    const element = document.createElement("div");
    (element as any).__reactFiber$test = {
      elementType: () => null,
      memoizedProps: { app: { appid: 10 } },
      return: null,
    };
    expect(resolveNativeCapsuleFromElement(element)).toBeNull();
  });

  it("marks the native game name when Steam scales the complete capsule", () => {
    const host = document.createElement("div");
    const name = document.createElement("div");
    name.textContent = "ELDEN RING";
    host.appendChild(name);

    Object.defineProperty(host, "offsetHeight", { value: 310 });
    host.getBoundingClientRect = () => ({ top: 100, width: 154.8, height: 279 } as DOMRect);
    name.getBoundingClientRect = () => ({ top: 333, width: 100, height: 21 } as DOMRect);

    annotateNativeCard(host, "ELDEN RING", 258);

    expect(name.classList.contains("ds-native-game-name")).toBe(true);
  });

  it("marks Steam's original native label container for direct repositioning", () => {
    const host = document.createElement("div");
    const nativeLabel = document.createElement("div");
    nativeLabel.className = "SteamNativeLabelOuter";
    host.appendChild(nativeLabel);
    (window as any).__DS_CLASS_MAP = { nativeLabelOuter: "SteamNativeLabelOuter" };
    (globalThis as any).CSS = { escape: (value: string) => value };

    annotateNativeCard(host, "", 258);

    expect(nativeLabel.classList.contains("ds-native-game-info-root")).toBe(true);
    delete (window as any).__DS_CLASS_MAP;
    delete (globalThis as any).CSS;
  });

});

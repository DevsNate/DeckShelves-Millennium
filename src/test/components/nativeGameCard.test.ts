// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveNativeCapsuleFromElement } from "../../components/shelf/NativeGameCard";

describe("native capsule discovery", () => {
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
});

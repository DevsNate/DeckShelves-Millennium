// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveNativeCarouselFromElement } from "../../components/shelf/NativeShelfCarousel";

describe("native shelf carousel discovery", () => {
  it("finds Steam's generic virtualized carousel and preserves its motion contract", () => {
    const element = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "ReactVirtualized__Grid";
    grid.style.paddingRight = "48px";
    grid.appendChild(element);
    document.body.appendChild(grid);
    const NativeCarousel = () => null;
    Object.defineProperty(element, "offsetHeight", { value: 258 });
    (element as any).__reactFiber$test = {
      memoizedProps: { appid: 10 },
      return: {
        elementType: NativeCarousel,
        memoizedProps: {
          fnItemRenderer: () => null,
          fnGetColumnWidth: () => 172,
          fnGetId: () => "10",
          fnDoesItemTakeFocus: () => true,
          nNumItems: 20,
          nHeight: 368,
          nItemHeight: 310,
          nItemMarginX: 12,
          className: "native-carousel",
          scrollDuration: 120,
          scrollToAlignment: "center",
        },
        return: null,
      },
    };

    expect(resolveNativeCarouselFromElement(element)).toEqual({
      component: NativeCarousel,
      className: "native-carousel",
      scrollDuration: 120,
      scrollTiming: "sine",
      scrollToAlignment: "center",
      itemMarginX: 12,
      rightPadding: 48,
    });
  });

  it("rejects an individual card component", () => {
    const element = document.createElement("div");
    (element as any).__reactFiber$test = {
      elementType: () => null,
      memoizedProps: { appid: 10, nWidth: 172, nHeight: 310 },
      return: null,
    };
    expect(resolveNativeCarouselFromElement(element)).toBeNull();
  });
});

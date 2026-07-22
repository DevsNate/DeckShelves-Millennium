// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { NativeShelfCarousel, resolveNativeCarouselFromElement } from "../../components/shelf/NativeShelfCarousel";

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

  it("lets Steam commit the focused column after native movement completes", async () => {
    const renders: any[] = [];
    const NativeCarousel = (props: any) => {
      renders.push(props);
      return null;
    };
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => root.render(createElement(NativeShelfCarousel, {
      resolution: {
        component: NativeCarousel,
        className: "native-carousel",
        scrollDuration: 120,
        scrollTiming: "sine",
        scrollToAlignment: "center",
        itemMarginX: 12,
        rightPadding: 0,
      },
      name: "Test shelf",
      itemCount: 4,
      itemHeight: 310,
      viewportHeight: 340,
      itemMarginX: 12,
      getItemWidth: () => 172,
      getItemId: (index) => String(index),
      doesItemTakeFocus: () => true,
      renderItem: () => null,
    })));

    expect(renders.at(-1)).not.toHaveProperty("fnOnFocusedColumnChange");
    expect(renders.at(-1).focusedColumn).toBe(0);
    await act(async () => renders.at(-1).setFocusedColumn(2));
    expect(renders.at(-1).focusedColumn).toBe(2);

    await act(async () => root.unmount());
  });

});

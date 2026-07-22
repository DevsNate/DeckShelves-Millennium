import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { getPreferredSteamDocument } from "../../runtime/steamHost";
import { subscribeControllerInput } from "../../runtime/controllerInput";
import { NativeCarouselControllerInputContext } from "./nativeCarouselInputMode";

export type NativeCarouselResolution = {
  component: ComponentType<any>;
  className: string;
  scrollDuration: number;
  scrollTiming: string;
  scrollToAlignment: string;
  itemMarginX: number;
  rightPadding: number;
};

const resolutionCache = new WeakMap<Document, NativeCarouselResolution>();

function reactFiberFor(element: HTMLElement): any | null {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactFiber$"));
  return key ? (element as any)[key] ?? null : null;
}

/** Resolve Steam's generic, one-row virtualized carousel.
 *
 * This is the component above the individual Recent Games cards. It owns the
 * ReactVirtualized grid, centred-column scrolling, the stock 120 ms sine
 * animation, gamepad direction handling and focus hand-off after a pan.
 */
export function resolveNativeCarouselFromElement(element: HTMLElement): NativeCarouselResolution | null {
  let fiber = reactFiberFor(element);
  while (fiber) {
    const props = fiber.memoizedProps;
    const component = fiber.elementType ?? fiber.type;
    if (
      typeof props?.fnItemRenderer === "function" &&
      typeof props.fnGetColumnWidth === "function" &&
      typeof props.fnGetId === "function" &&
      typeof props.fnDoesItemTakeFocus === "function" &&
      Number.isFinite(props.nNumItems) &&
      Number.isFinite(props.nHeight) &&
      Number.isFinite(props.nItemHeight) &&
      Number.isFinite(props.nItemMarginX) &&
      component &&
      (typeof component === "function" || typeof component === "object")
    ) {
      const grid = element.closest<HTMLElement>('.ReactVirtualized__Grid');
      const gridStyle = grid ? getComputedStyle(grid) : null;
      const rightPadding = Math.max(
        Number.parseFloat(gridStyle?.paddingRight ?? "0") || 0,
        Number.parseFloat(gridStyle?.scrollPaddingRight ?? "0") || 0,
      );
      return {
        component,
        className: typeof props.className === "string" ? props.className : "",
        scrollDuration: Number.isFinite(props.scrollDuration) ? Number(props.scrollDuration) : 120,
        scrollTiming: typeof props.scrollTiming === "string" ? props.scrollTiming : "sine",
        scrollToAlignment: typeof props.scrollToAlignment === "string" ? props.scrollToAlignment : "center",
        itemMarginX: Number(props.nItemMarginX),
        rightPadding,
      };
    }
    fiber = fiber.return;
  }
  return null;
}

export function resolveNativeCarousel(doc: Document | null): NativeCarouselResolution | null {
  if (!doc) return null;
  const cached = resolutionCache.get(doc);
  if (cached) return cached;
  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('[role="link"]'));
  for (const element of candidates) {
    if (element.closest("#deck-shelves-home-root")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) continue;
    const resolution = resolveNativeCarouselFromElement(element);
    if (!resolution) continue;
    resolutionCache.set(doc, resolution);
    return resolution;
  }
  return null;
}

export function useNativeCarouselResolution(): NativeCarouselResolution | null {
  const [resolution, setResolution] = useState<NativeCarouselResolution | null>(() =>
    resolveNativeCarousel(getPreferredSteamDocument()),
  );
  useEffect(() => {
    if (resolution) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const next = resolveNativeCarousel(getPreferredSteamDocument());
      if (next) {
        setResolution(next);
        window.clearInterval(timer);
      } else if (++attempts >= 20) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [resolution]);
  return resolution;
}

export type NativeShelfCarouselProps = {
  resolution: NativeCarouselResolution;
  name: string;
  itemCount: number;
  itemHeight: number;
  viewportHeight: number;
  itemMarginX: number;
  className?: string;
  getItemWidth: (index: number) => number;
  getItemId: (index: number) => string;
  doesItemTakeFocus: (index: number) => boolean;
  renderItem: (index: number, width: number, height: number, left: number, suppressNativeLabel: boolean) => ReactNode;
};

export function NativeShelfCarousel({
  resolution,
  name,
  itemCount,
  itemHeight,
  viewportHeight,
  itemMarginX,
  className = "",
  getItemWidth,
  getItemId,
  doesItemTakeFocus,
  renderItem,
}: NativeShelfCarouselProps) {
  const [focusedColumn, setFocusedColumn] = useState(0);
  const [movingToColumn, setMovingToColumn] = useState<number | null>(null);
  const [controllerInputActive, setControllerInputActive] = useState(false);
  const controllerInputActiveRef = useRef(false);
  const NativeCarousel = resolution.component;
  const nativeClassName = [resolution.className, className].filter(Boolean).join(" ");

  useEffect(() => {
    const setController = () => {
      controllerInputActiveRef.current = true;
      setControllerInputActive(true);
    };
    const unsubscribe = subscribeControllerInput((event) => {
      if (event.pressed) setController();
    });
    const doc = getPreferredSteamDocument();
    const onMouseMove = (event: MouseEvent) => {
      if (!controllerInputActiveRef.current) return;
      if (event.movementX === 0 && event.movementY === 0) return;
      controllerInputActiveRef.current = false;
      setControllerInputActive(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      setController();
    };
    doc?.addEventListener("mousemove", onMouseMove, true);
    doc?.addEventListener("keydown", onKeyDown, true);
    return () => {
      unsubscribe();
      doc?.removeEventListener("mousemove", onMouseMove, true);
      doc?.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (focusedColumn >= itemCount) setFocusedColumn(Math.max(0, itemCount - 1));
  }, [focusedColumn, itemCount]);

  return (
    <NativeCarouselControllerInputContext.Provider value={controllerInputActive}>
      <NativeCarousel
        name={name}
        aria-label={name}
        className={nativeClassName}
        fnItemRenderer={(index: number, width: number, height: number, left: number) =>
          renderItem(
            index,
            width,
            height,
            left,
            (movingToColumn !== null || controllerInputActive) && index !== focusedColumn,
          )}
        fnGetColumnWidth={getItemWidth}
        fnGetId={getItemId}
        fnOnScroll={() => {}}
        fnDoesItemTakeFocus={doesItemTakeFocus}
        nNumItems={itemCount}
        nHeight={viewportHeight}
        nItemHeight={itemHeight}
        nItemMarginX={itemMarginX}
        autoFocus={false}
        scrollToAlignment={resolution.scrollToAlignment}
        scrollDuration={resolution.scrollDuration}
        scrollTiming={resolution.scrollTiming}
        overscan={Math.max(3, Math.min(19, itemCount - 1))}
        focusedColumn={focusedColumn}
        fnOnFocusedColumnChange={(_from: number, to: number) => setMovingToColumn(to)}
        setFocusedColumn={(column: number) => {
          setFocusedColumn(column);
          setMovingToColumn(null);
        }}
        autoHeight={false}
      />
    </NativeCarouselControllerInputContext.Provider>
  );
}

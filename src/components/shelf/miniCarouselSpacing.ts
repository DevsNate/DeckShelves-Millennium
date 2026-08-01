const NATIVE_GRID_VERTICAL_PADDING_PX = 28;
const NATIVE_GRID_TOP_MARGIN_PX = 4;
const DECK_SHELF_TITLE_MARGIN_PX = 8;

/* Mini Carousel scales Steam's native grid around its vertical centre, which
 * creates a top inset equal to half the height lost to scaling. Deck Shelves
 * keeps its grid top-anchored, so add only that missing visual inset to the
 * title margin while leaving row height and card geometry untouched. */
export function miniCarouselTitleGapCompensation(
  viewportHeight: number,
  scale: number,
): number {
  if (!Number.isFinite(viewportHeight) || !Number.isFinite(scale)) return 0;
  const safeHeight = Math.max(0, viewportHeight);
  const safeScale = Math.max(0.5, Math.min(1.5, scale));
  const centeredScaleInset =
    ((safeHeight + NATIVE_GRID_VERTICAL_PADDING_PX) * (1 - safeScale)) / 2;
  return Math.max(
    0,
    centeredScaleInset + NATIVE_GRID_TOP_MARGIN_PX - DECK_SHELF_TITLE_MARGIN_PX,
  );
}

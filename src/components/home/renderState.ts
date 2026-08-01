export function shouldRenderHomeShelves(
  pluginEnabled: boolean | undefined,
  shelves: readonly unknown[],
): boolean {
  return pluginEnabled === true && shelves.length > 0;
}

type ShelfRenderChild = {
  classList: { contains(className: string): boolean };
  querySelector?(selector: string): unknown;
};

export function isOwnedShelfRenderChild(child: ShelfRenderChild): boolean {
  return child.classList.contains("ds-shelf")
    || child.classList.contains("ds-shelf-loading")
    || child.querySelector?.(":scope > .ds-shelf") != null;
}

/**
 * Build the focused-card label used by the "game info above" overlay.
 *
 * Custom Deck Shelves cards expose a complete `.ds-card-label`, so preserve
 * that DOM exactly. Native cards deliberately return null: their original
 * Steam label element stays mounted and is repositioned directly by CSS.
 */
export function cloneGameInfoLabel(card: HTMLElement): HTMLElement | null {
  const customLabel = card.querySelector<HTMLElement>('.ds-card-label');
  if (customLabel) return customLabel.cloneNode(true) as HTMLElement;
  return null;
}

/** Only the shelf that currently owns card focus gets a selected-item header. */
export function shouldShowGameInfoOverlay(infoAbove: boolean, hasLabel: boolean, isShelfSelected: boolean): boolean {
  return infoAbove && hasLabel && isShelfSelected;
}

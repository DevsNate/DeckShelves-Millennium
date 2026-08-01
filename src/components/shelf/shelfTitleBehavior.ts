export const NATIVE_SHELF_TITLE_VISIBLE_MS = 8000;

const AUTO_HIDE_ATTR = "data-ds-title-auto-hide";
const VISIBLE_ATTR = "data-ds-title-visible";
const TRANSITION = "transform 500ms ease-in-out, opacity 500ms ease-in-out";

type InlineProperty = {
  value: string;
  priority: string;
};

function readInlineProperty(element: HTMLElement, property: string): InlineProperty {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreInlineProperty(
  element: HTMLElement,
  property: string,
  original: InlineProperty,
): void {
  if (!original.value) {
    element.style.removeProperty(property);
    return;
  }
  element.style.setProperty(property, original.value, original.priority);
}

function cardFromTarget(target: EventTarget | null): HTMLElement | null {
  const element = target as Element | null;
  return typeof element?.closest === "function"
    ? element.closest<HTMLElement>(".ds-card")
    : null;
}

/* Mirror Steam's Recent Games heading lifecycle: show initially, restart the
 * eight-second visibility window whenever a card receives focus, then hide.
 * Pointer entry is included because Steam's Focusable cards convert hover
 * into the same item-focus callback. */
export function installShelfTitleAutoHide(
  title: HTMLElement,
  row: HTMLElement,
): () => void {
  const win = title.ownerDocument.defaultView ?? window;
  let hideTimer: number | null = null;
  let lastPointerCard: HTMLElement | null = null;
  const originalOpacity = readInlineProperty(title, "opacity");
  const originalTransform = readInlineProperty(title, "transform");
  const originalTransition = readInlineProperty(title, "transition");
  const computedOpacity = win.getComputedStyle(title).opacity;
  const root = title.closest<HTMLElement>(".deck-shelves-root");
  const resolveVisibleOpacity = () => {
    const nativeOpacity = root
      ? win.getComputedStyle(root).getPropertyValue("--ds-native-title-opacity").trim()
      : "";
    return nativeOpacity || computedOpacity || "1";
  };

  /* CSS Loader themes can target the native classes borrowed by this title
   * with high-specificity or !important opacity rules. Inline-important state
   * keeps the native fade authoritative while the variable preserves the
   * actual theme/native visible opacity. */
  title.style.setProperty("transition", TRANSITION, "important");

  const reveal = () => {
    title.setAttribute(AUTO_HIDE_ATTR, "true");
    title.setAttribute(VISIBLE_ATTR, "true");
    title.style.setProperty("opacity", resolveVisibleOpacity(), "important");
    title.style.setProperty("transform", "translateY(0)", "important");
    if (hideTimer !== null) win.clearTimeout(hideTimer);
    hideTimer = win.setTimeout(() => {
      hideTimer = null;
      title.setAttribute(VISIBLE_ATTR, "false");
      title.style.setProperty("opacity", "0", "important");
      title.style.setProperty("transform", "translateY(-1px)", "important");
    }, NATIVE_SHELF_TITLE_VISIBLE_MS);
  };

  const onFocusIn = (event: FocusEvent) => {
    if (cardFromTarget(event.target)) reveal();
  };
  const onPointerOver = (event: PointerEvent) => {
    const card = cardFromTarget(event.target);
    if (!card || card === lastPointerCard) return;
    lastPointerCard = card;
    reveal();
  };
  const onPointerLeave = () => {
    lastPointerCard = null;
  };

  const Observer = win.MutationObserver ?? MutationObserver;
  const observer = new Observer((mutations) => {
    const gainedGamepadFocus = mutations.some((mutation) => {
      if (mutation.type !== "attributes" || mutation.attributeName !== "class") return false;
      const target = mutation.target as HTMLElement;
      return target.classList?.contains("gpfocus")
        && !(mutation.oldValue ?? "").split(/\s+/).includes("gpfocus")
        && !!target.closest(".ds-card");
    });
    if (gainedGamepadFocus) reveal();
  });

  row.addEventListener("focusin", onFocusIn);
  row.addEventListener("pointerover", onPointerOver);
  row.addEventListener("pointerleave", onPointerLeave);
  observer.observe(row, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true,
  });
  reveal();

  return () => {
    row.removeEventListener("focusin", onFocusIn);
    row.removeEventListener("pointerover", onPointerOver);
    row.removeEventListener("pointerleave", onPointerLeave);
    observer.disconnect();
    if (hideTimer !== null) win.clearTimeout(hideTimer);
    title.removeAttribute(AUTO_HIDE_ATTR);
    title.removeAttribute(VISIBLE_ATTR);
    restoreInlineProperty(title, "opacity", originalOpacity);
    restoreInlineProperty(title, "transform", originalTransform);
    restoreInlineProperty(title, "transition", originalTransition);
  };
}

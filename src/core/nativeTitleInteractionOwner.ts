import { subscribeControllerInput } from "../runtime/controllerInput";

const SUPPRESS_ATTR = "data-ds-hover-suppress-native-label";

function nativeCards(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".ds-card--native"));
}

export function setNativeTitlePointerOwner(
  root: HTMLElement,
  owner: HTMLElement | null,
  suppressAll = false,
): void {
  nativeCards(root).forEach((card) => {
    if (suppressAll || (owner && card !== owner)) card.setAttribute(SUPPRESS_ATTR, "true");
    else card.removeAttribute(SUPPRESS_ATTR);
  });
}

function cardAtPoint(root: HTMLElement, clientX: number, clientY: number): HTMLElement | null {
  const target = root.ownerDocument.elementFromPoint(clientX, clientY);
  const card = target?.closest<HTMLElement>(".ds-card--native") ?? null;
  return card && root.contains(card) ? card : null;
}

/** Own pointer lifecycle for borrowed native cards. Steam captures the
 * pointer while panning, so card-level mouseleave is unreliable. Document
 * hit-testing keeps title ownership aligned through capture and cancellation
 * without replacing Steam's title or Art Hero animation. */
export function installNativeTitleInteractionOwner(root: HTMLElement): () => void {
  const doc = root.ownerDocument;
  let pressedPointer: number | null = null;
  let pressedCard: HTMLElement | null = null;
  let suppressAfterDragAway = false;
  const staleAfterCapturedDrag = new Set<HTMLElement>();
  let lastX = 0;
  let lastY = 0;

  const applyOwner = (owner: HTMLElement | null, suppressAll = false) => {
    nativeCards(root).forEach((card) => {
      if (suppressAll || staleAfterCapturedDrag.has(card) || (owner && card !== owner)) {
        card.setAttribute(SUPPRESS_ATTR, "true");
      } else {
        card.removeAttribute(SUPPRESS_ATTR);
      }
    });
  };

  const applyPoint = (clientX: number, clientY: number, pointerIsPressed: boolean) => {
    lastX = clientX;
    lastY = clientY;
    const card = cardAtPoint(root, clientX, clientY);
    if (card) {
      suppressAfterDragAway = false;
      staleAfterCapturedDrag.delete(card);
      applyOwner(card);
      return;
    }
    if (pointerIsPressed || suppressAfterDragAway) {
      suppressAfterDragAway = true;
      if (pressedCard) staleAfterCapturedDrag.add(pressedCard);
      applyOwner(null, true);
      return;
    }
    applyOwner(null);
  };

  const onPointerDown = (event: PointerEvent) => {
    const card = cardAtPoint(root, event.clientX, event.clientY);
    if (!card) return;
    lastX = event.clientX;
    lastY = event.clientY;
    pressedPointer = event.pointerId;
    pressedCard = card;
    suppressAfterDragAway = false;
    staleAfterCapturedDrag.delete(card);
    applyOwner(card);
  };
  const onPointerMove = (event: PointerEvent) => {
    applyPoint(event.clientX, event.clientY, pressedPointer === event.pointerId || event.buttons !== 0);
  };
  const onPointerOver = (event: PointerEvent) => {
    applyPoint(event.clientX, event.clientY, pressedPointer === event.pointerId || event.buttons !== 0);
  };
  const finishPointer = (event: PointerEvent, cancelled: boolean) => {
    if (pressedPointer !== null && event.pointerId !== pressedPointer) return;
    const wasPressed = pressedPointer !== null;
    pressedPointer = null;
    const card = cardAtPoint(root, event.clientX, event.clientY);
    if (card && !cancelled) {
      suppressAfterDragAway = false;
      staleAfterCapturedDrag.delete(card);
      applyOwner(card);
    } else if (wasPressed) {
      suppressAfterDragAway = true;
      if (pressedCard) staleAfterCapturedDrag.add(pressedCard);
      applyOwner(null, true);
    }
    pressedCard = null;
  };
  const onPointerUp = (event: PointerEvent) => finishPointer(event, false);
  const onPointerCancel = (event: PointerEvent) => finishPointer(event, true);
  const onLostPointerCapture = (event: PointerEvent) => {
    if (pressedPointer !== event.pointerId) return;
    pressedPointer = null;
    const card = cardAtPoint(root, lastX, lastY);
    if (card) {
      staleAfterCapturedDrag.delete(card);
      applyOwner(card);
    }
    else {
      suppressAfterDragAway = true;
      if (pressedCard) staleAfterCapturedDrag.add(pressedCard);
      applyOwner(null, true);
    }
    pressedCard = null;
  };
  const onDragEnd = (event: DragEvent) => {
    pressedPointer = null;
    const card = cardAtPoint(root, event.clientX, event.clientY);
    if (card) {
      suppressAfterDragAway = false;
      staleAfterCapturedDrag.delete(card);
      applyOwner(card);
    } else {
      suppressAfterDragAway = true;
      if (pressedCard) staleAfterCapturedDrag.add(pressedCard);
      applyOwner(null, true);
    }
    pressedCard = null;
  };
  const resetForNavigation = () => {
    pressedPointer = null;
    pressedCard = null;
    suppressAfterDragAway = false;
    staleAfterCapturedDrag.clear();
    applyOwner(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    resetForNavigation();
  };
  const Observer = doc.defaultView?.MutationObserver ?? MutationObserver;
  const focusObserver = new Observer((mutations) => {
    const gainedNativeGamepadFocus = mutations.some((mutation) => {
      if (mutation.type !== "attributes" || mutation.attributeName !== "class") return false;
      const target = mutation.target as HTMLElement;
      return target.classList?.contains("gpfocus")
        && !target.classList.contains("ds-card--native")
        && !!target.closest(".ds-card--native");
    });
    if (gainedNativeGamepadFocus) resetForNavigation();
  });

  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("pointermove", onPointerMove, true);
  doc.addEventListener("pointerover", onPointerOver, true);
  doc.addEventListener("pointerup", onPointerUp, true);
  doc.addEventListener("pointercancel", onPointerCancel, true);
  doc.addEventListener("lostpointercapture", onLostPointerCapture, true);
  doc.addEventListener("dragend", onDragEnd, true);
  doc.addEventListener("keydown", onKeyDown, true);
  focusObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
  const unsubscribeController = subscribeControllerInput((event) => {
    if (!event.pressed) return;
    resetForNavigation();
  });

  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("pointermove", onPointerMove, true);
    doc.removeEventListener("pointerover", onPointerOver, true);
    doc.removeEventListener("pointerup", onPointerUp, true);
    doc.removeEventListener("pointercancel", onPointerCancel, true);
    doc.removeEventListener("lostpointercapture", onLostPointerCapture, true);
    doc.removeEventListener("dragend", onDragEnd, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    focusObserver.disconnect();
    unsubscribeController();
    staleAfterCapturedDrag.clear();
    setNativeTitlePointerOwner(root, null);
  };
}

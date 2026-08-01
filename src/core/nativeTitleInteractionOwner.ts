import { subscribeControllerInput } from "../runtime/controllerInput";
import { getAllSteamDocuments, getPreferredSteamDocument } from "../runtime/steamHost";
import { getRuntimeClassMap } from "./webpackCompat";

const SUPPRESS_ATTR = "data-ds-hover-suppress-native-label";
const STEAM_SUPPRESS_ATTR = "data-ds-controller-suppress-native-label";

type SavedInlineStyle = {
  value: string;
  priority: string;
};

type SavedSteamLabelStyle = {
  opacity: SavedInlineStyle;
  visibility: SavedInlineStyle;
};

const savedSteamLabelStyles = new Map<HTMLElement, SavedSteamLabelStyle>();

function hasNativeGrid(doc: Document): boolean {
  return !!doc.querySelector(".ReactVirtualized__Grid__innerScrollContainer, .ReactVirtualized__Grid");
}

function steamDocuments(root: HTMLElement): Document[] {
  const docs = [root.ownerDocument, ...getAllSteamDocuments()];
  try { docs.push(getPreferredSteamDocument()); } catch {}
  return Array.from(new Set(docs));
}

function steamRecentsDocument(root: HTMLElement): Document {
  return steamDocuments(root).find(hasNativeGrid) ?? root.ownerDocument;
}

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

function readInlineStyle(element: HTMLElement, property: string): SavedInlineStyle {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(element: HTMLElement, property: string, saved: SavedInlineStyle): void {
  if (saved.value) element.style.setProperty(property, saved.value, saved.priority);
  else element.style.removeProperty(property);
}

function suppressSteamLabel(element: HTMLElement): void {
  if (!savedSteamLabelStyles.has(element)) {
    savedSteamLabelStyles.set(element, {
      opacity: readInlineStyle(element, "opacity"),
      visibility: readInlineStyle(element, "visibility"),
    });
  }
  element.setAttribute(STEAM_SUPPRESS_ATTR, "true");
  element.style.setProperty("opacity", "0", "important");
  element.style.setProperty("visibility", "hidden", "important");
}

function restoreSteamLabel(element: HTMLElement): void {
  const saved = savedSteamLabelStyles.get(element);
  element.removeAttribute(STEAM_SUPPRESS_ATTR);
  if (!saved) return;
  restoreInlineStyle(element, "opacity", saved.opacity);
  restoreInlineStyle(element, "visibility", saved.visibility);
  savedSteamLabelStyles.delete(element);
}

function restoreAllSteamLabels(): void {
  for (const element of Array.from(savedSteamLabelStyles.keys())) restoreSteamLabel(element);
}

function nativeLabelClassTokens(root: HTMLElement): string[] {
  const doc = steamRecentsDocument(root);
  const token = getRuntimeClassMap(doc)?.nativeLabelOuter?.trim();
  if (token) return token.split(/\s+/).filter(Boolean);
  const annotated = doc.querySelector<HTMLElement>("#deck-shelves-home-root .ds-native-game-info-root");
  return annotated ? Array.from(annotated.classList).filter((name) => !name.startsWith("ds-")) : [];
}

function hasClassTokens(element: HTMLElement, tokens: string[]): boolean {
  return tokens.every((token) => element.classList.contains(token));
}

function labelElements(item: HTMLElement, tokens: string[]): HTMLElement[] {
  if (!tokens.length) return [];
  return Array.from(item.querySelectorAll<HTMLElement>("[class]"))
    .filter((element) => hasClassTokens(element, tokens));
}

function nativeSteamGrids(root: HTMLElement): HTMLElement[] {
  const doc = steamRecentsDocument(root);
  const inner = Array.from(doc.querySelectorAll<HTMLElement>(".ReactVirtualized__Grid__innerScrollContainer"))
    .filter((element) => !element.closest("#deck-shelves-home-root"));
  if (inner.length) return inner;
  return Array.from(doc.querySelectorAll<HTMLElement>(".ReactVirtualized__Grid"))
    .filter((element) => !element.closest("#deck-shelves-home-root"));
}

function focusedListItem(grid: HTMLElement): HTMLElement | null {
  const item = grid.querySelector<HTMLElement>(".gpfocus")?.closest<HTMLElement>("[role='listitem']") ?? null;
  return item && grid.contains(item) ? item : null;
}

function reactFiberFor(element: HTMLElement): any | null {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactFiber$"));
  return key ? (element as any)[key] ?? null : null;
}

type NativeHoverInteraction = {
  showAsHovered: boolean;
};

function nativeHoverInteraction(element: HTMLElement): NativeHoverInteraction | null {
  let fiber = reactFiberFor(element);
  while (fiber) {
    const props = fiber.memoizedProps;
    if (Number.isFinite(props?.appid) && typeof props.showAsHovered === "boolean") {
      return { showAsHovered: props.showAsHovered };
    }
    fiber = fiber.return;
  }
  return null;
}

function ownsNativeFocus(card: HTMLElement): boolean {
  return card.classList.contains("gpfocus") || !!card.querySelector(".gpfocus");
}

type ReactStateHook = {
  memoizedState?: unknown;
  queue?: { dispatch?: (value: unknown) => void } | null;
  next?: ReactStateHook | null;
};

function enableNativeCarouselControllerMode(card: HTMLElement): boolean {
  let fiber = reactFiberFor(card);
  while (fiber) {
    const props = fiber.memoizedProps;
    if (Array.isArray(props?.games) && typeof props.showFeaturedItem === "boolean") {
      let hook = fiber.memoizedState as ReactStateHook | null;
      while (hook) {
        if (hook.memoizedState === false && typeof hook.queue?.dispatch === "function") {
          hook.queue.dispatch(true);
          return true;
        }
        hook = hook.next ?? null;
      }
      return false;
    }
    fiber = fiber.return;
  }
  return false;
}

/** Steam restores a Recent Games card's gamepad focus after a game-page round
 * trip, but its remounted carousel can miss the navigation-source event. Sync
 * the carousel's own controller-mode state so item zero is not rendered as the
 * pointer fallback while another card owns gamepad focus. */
export function syncSteamNativeCarouselControllerMode(root: HTMLElement): number {
  let synced = 0;
  for (const grid of nativeSteamGrids(root)) {
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[role='link']"))
      .filter((card) => nativeHoverInteraction(card) !== null);
    if (!cards.some(ownsNativeFocus)) continue;
    const owner = cards[0];
    if (owner && enableNativeCarouselControllerMode(owner)) synced++;
  }
  return synced;
}

function steamLabelsWithoutControllerFocus(root: HTMLElement, tokens: string[]): Set<HTMLElement> {
  const labels = new Set<HTMLElement>();
  const anyGamepadFocus = !!steamRecentsDocument(root).querySelector(".gpfocus");
  for (const grid of nativeSteamGrids(root)) {
    const focused = focusedListItem(grid);
    if (!focused && !anyGamepadFocus) continue;
    for (const item of Array.from(grid.querySelectorAll<HTMLElement>("[role='listitem']"))) {
      if (item === focused) continue;
      for (const label of labelElements(item, tokens)) labels.add(label);
    }
  }
  return labels;
}

export function setSteamNativeTitleInputOwner(root: HTMLElement, controllerMode: boolean): void {
  if (!controllerMode) {
    restoreAllSteamLabels();
    return;
  }
  const tokens = nativeLabelClassTokens(root);
  if (!tokens.length) {
    restoreAllSteamLabels();
    return;
  }
  const next = steamLabelsWithoutControllerFocus(root, tokens);
  for (const element of Array.from(savedSteamLabelStyles.keys())) {
    if (!next.has(element)) restoreSteamLabel(element);
  }
  for (const element of next) suppressSteamLabel(element);
}

/** Keep Steam's native Recent Games titles aligned with the active input
 * modality. A controller focus owns one native label; pointer activity hands
 * title ownership back to Steam's hover rules. */
export function installSteamNativeTitleInputOwner(root: HTMLElement): () => void {
  const docs = steamDocuments(root);
  let controllerMode = false;
  let syncQueued = false;
  const sync = () => {
    syncQueued = false;
    setSteamNativeTitleInputOwner(root, controllerMode);
    if (controllerMode) syncSteamNativeCarouselControllerMode(root);
  };
  const queueSync = () => {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(sync);
  };
  const activateController = () => {
    controllerMode = true;
    queueSync();
  };
  const activatePointer = () => {
    controllerMode = false;
    setSteamNativeTitleInputOwner(root, false);
  };
  const anyNativeGamepadFocus = () =>
    nativeSteamGrids(root).some((grid) => !!grid.querySelector(".gpfocus"));
  const onKeyDown = (event: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Escape"].includes(event.key)) {
      activateController();
    }
  };
  const observations = docs.map((doc) => {
    const Observer = doc.defaultView?.MutationObserver ?? MutationObserver;
    const observer = new Observer((mutations) => {
      const focusChanged = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          return Array.from(mutation.addedNodes).some((node) => {
            const ElementCtor = doc.defaultView?.Element;
            if (ElementCtor && !(node instanceof ElementCtor)) return false;
            const element = node as Element;
            return element.matches(".ReactVirtualized__Grid, .ReactVirtualized__Grid__innerScrollContainer, .gpfocus")
              || !!element.querySelector(".ReactVirtualized__Grid, .ReactVirtualized__Grid__innerScrollContainer, .gpfocus");
          });
        }
        if (mutation.type !== "attributes" || mutation.attributeName !== "class") return false;
        const element = mutation.target as HTMLElement;
        return element.classList.contains("gpfocus")
          || (mutation.oldValue ?? "").split(/\s+/).includes("gpfocus");
      });
      if (!focusChanged) return;
      if (anyNativeGamepadFocus()) controllerMode = true;
      queueSync();
    });
    if (doc.body) {
      observer.observe(doc.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
        attributeOldValue: true,
      });
    }
    doc.addEventListener("pointermove", activatePointer, true);
    doc.addEventListener("pointerdown", activatePointer, true);
    doc.addEventListener("keydown", onKeyDown, true);
    return { doc, observer };
  });
  const unsubscribeController = subscribeControllerInput((event) => {
    if (event.pressed) activateController();
  });

  if (anyNativeGamepadFocus()) {
    controllerMode = true;
    sync();
  }

  return () => {
    for (const { doc, observer } of observations) {
      doc.removeEventListener("pointermove", activatePointer, true);
      doc.removeEventListener("pointerdown", activatePointer, true);
      doc.removeEventListener("keydown", onKeyDown, true);
      observer.disconnect();
    }
    unsubscribeController();
    restoreAllSteamLabels();
  };
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

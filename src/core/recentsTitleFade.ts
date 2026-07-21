import { buildSelectorFromToken, getRuntimeClassMap } from "./webpackCompat";

const FADED_ATTR = "data-ds-recents-title-faded";

function isDeckShelvesNode(element: Element | null): boolean {
  return !!element?.closest?.("#deck-shelves-home-root, .deck-shelves-root, .ds-shelf");
}

function elementFromDocument(value: unknown, doc: Document): Element | null {
  if (!value || typeof value !== "object") return null;
  const ElementCtor = doc.defaultView?.Element;
  if (ElementCtor && value instanceof ElementCtor) return value as Element;
  return (value as Node).nodeType === 1 ? value as Element : null;
}

export function findNativeRecentsSection(mountEl: HTMLElement): HTMLElement | null {
  const parent = mountEl.parentElement;
  if (!parent) return null;

  const previous = mountEl.previousElementSibling as HTMLElement | null;
  if (previous && !isDeckShelvesNode(previous)) return previous;

  const siblings = Array.from(parent.children) as HTMLElement[];
  const mountIndex = siblings.indexOf(mountEl);
  for (let index = mountIndex - 1; index >= 0; index--) {
    const candidate = siblings[index];
    if (isDeckShelvesNode(candidate)) continue;
    if (candidate.querySelector('[aria-label], .ReactVirtualized__Grid')) return candidate;
  }
  return null;
}

export function findNativeRecentsTitle(mountEl: HTMLElement): HTMLElement | null {
  const section = findNativeRecentsSection(mountEl);
  if (!section) return null;

  try {
    const token = getRuntimeClassMap(mountEl.ownerDocument)?.nativeShelfTitle;
    const selector = token ? buildSelectorFromToken(token) : "";
    const byClass = selector ? section.querySelector<HTMLElement>(selector) : null;
    if (byClass) return byClass;
  } catch {}

  const semantic = section.querySelector<HTMLElement>("h1, h2, h3, [role='heading']");
  if (semantic) return semantic;

  const grid = section.querySelector(".ReactVirtualized__Grid, [aria-label]");
  for (const candidate of Array.from(section.querySelectorAll<HTMLElement>("div, span"))) {
    if (candidate.closest("[role='link'], .ReactVirtualized__Grid")) continue;
    const text = (candidate.textContent ?? "").trim();
    if (!text || text.length > 80) continue;
    if (grid && (candidate.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue;
    try {
      if (Number.parseFloat(getComputedStyle(candidate).fontSize) >= 16) return candidate;
    } catch {}
  }
  return null;
}

/** Fade the native Recent Games heading only while focus belongs to an
 * injected Deck Shelves carousel. Steam remains responsible for the actual
 * vertical navigation and the title returns as soon as focus goes home. */
export function installRecentsTitleFade(mountEl: HTMLElement): () => void {
  const doc = mountEl.ownerDocument;
  let currentTitle: HTMLElement | null = null;
  let faded = false;
  let frame = 0;

  const apply = () => {
    const nextTitle = findNativeRecentsTitle(mountEl);
    if (currentTitle && currentTitle !== nextTitle) currentTitle.removeAttribute(FADED_ATTR);
    currentTitle = nextTitle;
    if (currentTitle) {
      if (faded) currentTitle.setAttribute(FADED_ATTR, "true");
      else currentTitle.removeAttribute(FADED_ATTR);
    }
  };

  const syncFromTarget = (target: Element | null) => {
    if (!target) return;
    if (isDeckShelvesNode(target)) {
      faded = true;
      apply();
      return;
    }
    const section = findNativeRecentsSection(mountEl);
    if (section?.contains(target)) {
      faded = false;
      apply();
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    const target = elementFromDocument(event.target, doc);
    syncFromTarget(target);
  };

  /* Big Picture's gamepad navigator usually moves its visual focus by
     swapping `.gpfocus` classes without moving `document.activeElement`.
     Coalesce those class mutations into one check so controller navigation
     follows the same path as mouse/keyboard focus without intercepting Steam. */
  const syncGamepadFocus = () => {
    frame = 0;
    const gamepadTarget = doc.querySelector<Element>(".gpfocus");
    const activeTarget = elementFromDocument(doc.activeElement, doc) !== doc.body
      ? elementFromDocument(doc.activeElement, doc)
      : null;
    syncFromTarget(gamepadTarget ?? activeTarget);
    apply();
  };
  const scheduleSync = () => {
    if (frame) return;
    frame = doc.defaultView?.setTimeout(syncGamepadFocus, 0) ?? window.setTimeout(syncGamepadFocus, 0);
  };

  const Observer = doc.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new Observer((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === "childList") return true;
      const target = elementFromDocument(mutation.target, doc);
      return mutation.attributeName === "class"
        && (target?.classList.contains("gpfocus") || (mutation.oldValue ?? "").split(/\s+/).includes("gpfocus"));
    });
    if (relevant) scheduleSync();
  });
  if (doc.body) {
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
  }
  doc.addEventListener("focusin", onFocusIn, true);
  mountEl.setAttribute("data-ds-recents-title-fade", "true");
  syncGamepadFocus();

  return () => {
    doc.removeEventListener("focusin", onFocusIn, true);
    observer.disconnect();
    mountEl.removeAttribute("data-ds-recents-title-fade");
    if (frame) {
      if (doc.defaultView) doc.defaultView.clearTimeout(frame);
      else window.clearTimeout(frame);
      frame = 0;
    }
    currentTitle?.removeAttribute(FADED_ATTR);
  };
}

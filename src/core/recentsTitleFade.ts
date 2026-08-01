import { buildSelectorFromToken, getRuntimeClassMap } from "./webpackCompat";

const FADED_ATTR = "data-ds-recents-title-faded";
const AUTO_HIDE_DISABLED_ATTR = "data-ds-native-title-auto-hide-disabled";
const VISIBLE_OPACITY_PROPERTY = "--ds-native-title-visible-opacity";
const HEADING_COLOR_PROPERTY = "--ds-native-heading-color";

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
    const map = getRuntimeClassMap(mountEl.ownerDocument);
    for (const token of [map?.nativeRecentsHeaderLabel, map?.nativeShelfTitle]) {
      const selector = token ? buildSelectorFromToken(token) : "";
      const byClass = selector ? section.querySelector<HTMLElement>(selector) : null;
      if (byClass) return byClass;
    }
  } catch {}

  const semantic = section.querySelector<HTMLElement>("h1, h2, h3, [role='heading']");
  if (semantic) {
    const label = Array.from(semantic.querySelectorAll<HTMLElement>("div, span"))
      .find((candidate) => {
        const text = (candidate.textContent ?? "").trim();
        return text.length > 0 && text.length <= 80 && candidate.children.length === 0;
      });
    return label ?? semantic;
  }

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

/**
 * Mirror the actual computed color of Steam's Recent Games label onto Deck
 * Shelves. Theme styles can be replaced without changing the label element,
 * so observe both the label and the document's theme/style surfaces.
 */
export function installNativeTitleColorMirror(
  mountEl: HTMLElement,
  targetRoot: HTMLElement,
): () => void {
  const doc = mountEl.ownerDocument;
  const win = doc.defaultView ?? window;
  const timers = new Set<number>();
  const observers: MutationObserver[] = [];
  const mirroredTitles = new Set<HTMLElement>();
  let currentTitle: HTMLElement | null = null;
  let titleObserver: MutationObserver | null = null;

  const applyColor = (color: string) => {
    targetRoot.style.setProperty(HEADING_COLOR_PROPERTY, color);
    for (const title of Array.from(
      targetRoot.querySelectorAll<HTMLElement>(".ds-shelf-title"),
    )) {
      title.style.setProperty("color", color, "important");
      mirroredTitles.add(title);
    }
  };
  const sample = () => {
    const nextTitle = findNativeRecentsTitle(mountEl);
    if (nextTitle !== currentTitle) {
      titleObserver?.disconnect();
      currentTitle = nextTitle;
      if (currentTitle) {
        const Observer = win.MutationObserver ?? MutationObserver;
        titleObserver = new Observer(() => scheduleSamples());
        titleObserver.observe(currentTitle, {
          attributes: true,
          attributeFilter: ["class", "style"],
        });
      }
    }
    if (!currentTitle) return;
    try {
      const color = win.getComputedStyle(currentTitle).color.trim();
      if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") {
        applyColor(color);
      }
    } catch {}
  };
  const schedule = (delay: number) => {
    const timer = win.setTimeout(() => {
      timers.delete(timer);
      sample();
    }, delay);
    timers.add(timer);
  };
  function scheduleSamples() {
    schedule(0);
    schedule(100);
    schedule(550);
  }
  const observe = (
    target: Node | null | undefined,
    options: MutationObserverInit,
  ) => {
    if (!target) return;
    const Observer = win.MutationObserver ?? MutationObserver;
    const observer = new Observer(() => scheduleSamples());
    observer.observe(target, options);
    observers.push(observer);
  };

  sample();
  scheduleSamples();
  observe(findNativeRecentsSection(mountEl), { childList: true, subtree: true });
  observe(doc.head, { childList: true, subtree: true, characterData: true });
  observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  observe(doc.body, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  observe(targetRoot, { childList: true, subtree: true });

  return () => {
    titleObserver?.disconnect();
    for (const observer of observers) observer.disconnect();
    for (const timer of timers) win.clearTimeout(timer);
    timers.clear();
    for (const title of mirroredTitles) title.style.removeProperty("color");
    mirroredTitles.clear();
    targetRoot.style.removeProperty(HEADING_COLOR_PROPERTY);
  };
}

/**
 * Keep Deck Shelves' title-opacity token aligned with Steam's live Recent
 * Games heading. Steam hides that heading after eight seconds, so only accept
 * non-zero samples and re-sample after its 500 ms enter transition.
 */
export function installNativeTitleOpacityMirror(
  mountEl: HTMLElement,
  targetRoot: HTMLElement,
): () => void {
  const doc = mountEl.ownerDocument;
  const win = doc.defaultView ?? window;
  const timers = new Set<number>();
  let currentTitle: HTMLElement | null = null;
  let observer: MutationObserver | null = null;

  targetRoot.style.setProperty("--ds-native-title-opacity", "0.7");

  const sample = () => {
    const nextTitle = findNativeRecentsTitle(mountEl);
    if (nextTitle !== currentTitle) {
      observer?.disconnect();
      currentTitle = nextTitle;
      if (currentTitle) {
        const Observer = win.MutationObserver ?? MutationObserver;
        observer = new Observer(() => scheduleSamples());
        observer.observe(currentTitle, { attributes: true, attributeFilter: ["class", "style"] });
      }
    }
    if (!currentTitle) return;
    try {
      const opacity = Number.parseFloat(win.getComputedStyle(currentTitle).opacity);
      if (Number.isFinite(opacity) && opacity > 0.05 && opacity <= 1) {
        targetRoot.style.setProperty("--ds-native-title-opacity", String(opacity));
      }
    } catch {}
  };
  const schedule = (delay: number) => {
    const timer = win.setTimeout(() => {
      timers.delete(timer);
      sample();
    }, delay);
    timers.add(timer);
  };
  function scheduleSamples() {
    schedule(0);
    schedule(550);
  }

  sample();
  scheduleSamples();
  const section = findNativeRecentsSection(mountEl);
  const sectionObserver = section
    ? new (win.MutationObserver ?? MutationObserver)(() => scheduleSamples())
    : null;
  sectionObserver?.observe(section!, { childList: true, subtree: true });

  return () => {
    observer?.disconnect();
    sectionObserver?.disconnect();
    for (const timer of timers) win.clearTimeout(timer);
    timers.clear();
    targetRoot.style.removeProperty("--ds-native-title-opacity");
  };
}

/** Keep Steam's own Recent Games title visible while the shared shelf-title
 * auto-hide option is off. Steam may replace the heading during a Home
 * rerender, so transfer ownership to each replacement rather than changing
 * its native HeaderEnter/HeaderExit classes. */
export function installNativeTitleAutoHideOverride(
  mountEl: HTMLElement,
  targetRoot: HTMLElement,
): () => void {
  const doc = mountEl.ownerDocument;
  const win = doc.defaultView ?? window;
  let currentTitle: HTMLElement | null = null;

  const release = (title: HTMLElement | null) => {
    title?.removeAttribute(AUTO_HIDE_DISABLED_ATTR);
    title?.style.removeProperty(VISIBLE_OPACITY_PROPERTY);
  };
  const apply = () => {
    const nextTitle = findNativeRecentsTitle(mountEl);
    if (nextTitle !== currentTitle) {
      release(currentTitle);
      currentTitle = nextTitle;
    }
    if (!currentTitle) return;
    const computedOpacity = Number.parseFloat(win.getComputedStyle(currentTitle).opacity);
    const mirroredOpacity = Number.parseFloat(
      targetRoot.style.getPropertyValue("--ds-native-title-opacity"),
    );
    const visibleOpacity = computedOpacity > 0.05
      ? computedOpacity
      : mirroredOpacity > 0.05
        ? mirroredOpacity
        : 0.7;
    currentTitle.style.setProperty(VISIBLE_OPACITY_PROPERTY, String(visibleOpacity));
    currentTitle.setAttribute(AUTO_HIDE_DISABLED_ATTR, "true");
  };

  const Observer = win.MutationObserver ?? MutationObserver;
  const observer = new Observer(() => apply());
  const observationRoot = mountEl.parentElement ?? doc.body;
  if (observationRoot) observer.observe(observationRoot, { childList: true, subtree: true });
  apply();

  return () => {
    observer.disconnect();
    release(currentTitle);
    currentTitle = null;
  };
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

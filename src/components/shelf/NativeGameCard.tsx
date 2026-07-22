import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { DeckRowItem } from "./types";
import { getPreferredSteamDocument } from "../../runtime/steamHost";
import { getCurrentSettings, saveSettings } from "../../store/settingsStore";
import { patchShelfInSettings } from "../../domain/settings";
import { createMatcherState, matchEvent, parseRawCombo, resolveBindings } from "../../runtime/buttonBindings";
import { subscribeControllerInput } from "../../runtime/controllerInput";
import { getRuntimeClassMap } from "../../core/webpackCompat";

export type NativeCapsuleResolution = {
  component: ComponentType<any>;
  labelHeight: number;
};

export function shouldShowNativeCardAsHovered(
  focused: boolean,
  gamepadFocused: boolean,
  suppressNativeLabel: boolean,
): boolean {
  return focused && gamepadFocused && !suppressNativeLabel;
}

const resolutionCache = new WeakMap<Document, NativeCapsuleResolution>();

function reactFiberFor(element: HTMLElement): any | null {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactFiber$"));
  return key ? (element as any)[key] ?? null : null;
}

/** Locate Steam's complete carousel item from a mounted native card.
 *
 * The lower `app/context` component is only the artwork capsule. Borrowing it
 * loses Steam's title/status band, focus animation, glow and navigation. The
 * `appid/nWidth/nHeight` component higher in the fiber tree owns that complete
 * native contract and is the component Deck Shelves must mount.
 */
export function resolveNativeCapsuleFromElement(element: HTMLElement): NativeCapsuleResolution | null {
  let fiber = reactFiberFor(element);
  while (fiber) {
    const props = fiber.memoizedProps;
    const component = fiber.elementType ?? fiber.type;
    if (
      Number.isFinite(props?.appid) &&
      typeof props.bFeatured === "boolean" &&
      typeof props.bShortLayout === "boolean" &&
      Number.isFinite(props.nWidth) &&
      Number.isFinite(props.nHeight) &&
      Number.isFinite(props.nCarouselWidth) &&
      typeof props.onItemFocus === "function" &&
      typeof props.onItemHover === "function" &&
      component &&
      (typeof component === "function" || typeof component === "object")
    ) {
      const measuredLabelHeight = Number(props.nHeight) - element.offsetHeight;
      const labelHeight = Number.isFinite(measuredLabelHeight) && measuredLabelHeight >= 24 && measuredLabelHeight <= 96
        ? measuredLabelHeight
        : 52;
      return { component, labelHeight };
    }
    fiber = fiber.return;
  }
  return null;
}

export function resolveNativeCapsule(doc: Document | null): NativeCapsuleResolution | null {
  if (!doc) return null;
  const cached = resolutionCache.get(doc);
  if (cached) return cached;
  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('[role="link"]'));
  for (const element of candidates) {
    if (element.closest("#deck-shelves-home-root")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) continue;
    const resolved = resolveNativeCapsuleFromElement(element);
    if (!resolved) continue;
    resolutionCache.set(doc, resolved);
    return resolved;
  }
  return null;
}

function getAppOverview(doc: Document | null, appid: number): any | null {
  const stores = [
    (doc?.defaultView as any)?.appStore,
    (doc?.defaultView as any)?.AppStore,
    (globalThis as any).appStore,
    (globalThis as any).AppStore,
  ];
  for (const store of stores) {
    try {
      const overview = store?.GetAppOverviewByAppID?.(appid);
      if (overview) return overview;
    } catch {}
  }
  return null;
}

function useNativeCapsuleResolution(): NativeCapsuleResolution | null {
  const [resolution, setResolution] = useState<NativeCapsuleResolution | null>(() =>
    resolveNativeCapsule(getPreferredSteamDocument()),
  );
  useEffect(() => {
    if (resolution) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const next = resolveNativeCapsule(getPreferredSteamDocument());
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

type NativeGameCardProps = {
  item: DeckRowItem;
  featured: boolean;
  cardW: number;
  cardH: number;
  nativeItemLeft?: number;
  nativeCarouselWidth?: number;
  suppressNativeLabel?: boolean;
  friendsOverlay?: boolean;
  previewMode?: boolean;
  hideStatusLine?: boolean;
  hideNewBadge?: boolean;
  hideDiscountBadge?: boolean;
  hideCompatIcons?: boolean;
  hideNonSteamBadge?: boolean;
  hideGameName?: boolean;
  hideInstallIndicator?: boolean;
  gameNamePosition?: "left" | "center" | "right";
  playtimePosition?: "left" | "center" | "right";
  removableSet?: Set<number>;
  onRemoveCard?: (appid: number) => void;
  hiddenSet?: Set<number>;
  onHideCard?: (appid: number) => void;
  fallback: ReactNode;
};

function normalizedText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function markTokenMatches(
  host: HTMLElement,
  map: Record<string, string> | null,
  keys: string[],
  marker: string,
): void {
  for (const key of keys) {
    const token = map?.[key];
    if (!token) continue;
    for (const className of token.split(/\s+/).filter(Boolean)) {
      try {
        host.querySelectorAll<HTMLElement>(`[class~="${CSS.escape(className)}"]`).forEach((node) => node.classList.add(marker));
      } catch {}
    }
  }
}

/** Add stable DS marker classes to Steam's hashed native label elements.
 * Runtime semantic tokens cover normal builds; geometry/text matching keeps
 * title/status visibility settings working when DFL is unavailable.
 */
export function annotateNativeCard(host: HTMLElement, itemName: string, cardHeight: number): void {
  host.querySelectorAll<HTMLElement>(".ds-native-game-info-root,.ds-native-game-name,.ds-native-status-line,.ds-native-compat,.ds-native-new-badge,.ds-native-discount-badge,.ds-native-install-indicator")
    .forEach((node) => node.classList.remove(
      "ds-native-game-info-root", "ds-native-game-name", "ds-native-status-line", "ds-native-compat",
      "ds-native-new-badge", "ds-native-discount-badge", "ds-native-install-indicator",
    ));

  const doc = host.ownerDocument;
  const map = getRuntimeClassMap(doc);
  markTokenMatches(host, map, ["nativeLabelOuter"], "ds-native-game-info-root");
  markTokenMatches(host, map, [
    "nativeStatus", "nativeStatusItem", "nativeStatusEntry", "nativeStatusText",
    "nativeStatusLine", "nativeStatusTime", "nativeStatusWrapper", "nativePlaytime",
    "nativePlaytimeStatus", "nativePlaytimeContent", "nativePlaytimeDetails",
    "nativePlaytimeSection", "nativePlayTimeRow",
  ], "ds-native-status-line");
  markTokenMatches(host, map, [
    "nativeDeckCompat", "nativeDeckCompatIcon", "nativeCompatIcon", "nativeCompatLabel",
    "nativeCompatFooterIcons", "nativeCompatFooterDescription",
  ], "ds-native-compat");
  markTokenMatches(host, map, ["nativeLibraryItemUpdateBadge"], "ds-native-install-indicator");

  const hostRect = host.getBoundingClientRect();
  /* Native capsules can be scaled by Steam's carousel transform. `cardHeight`
     is an unscaled layout value, while getBoundingClientRect() is transformed;
     compare in rendered coordinates so title detection still reaches the
     label band (for example 258 layout px renders as about 232 px at 0.9x). */
  const layoutHeight = host.offsetHeight;
  const renderedScaleY = layoutHeight > 0 && hostRect.height > 0 ? hostRect.height / layoutHeight : 1;
  const renderedArtBottom = hostRect.top + cardHeight * renderedScaleY;
  const labelBoundary = renderedArtBottom - 6;
  const expectedName = normalizedText(itemName);
  const leaves = Array.from(host.querySelectorAll<HTMLElement>("*"));
  for (const node of leaves) {
    const text = normalizedText(node.textContent);
    if (!text || Array.from(node.children).some((child) => normalizedText(child.textContent) === text)) continue;
    const rect = node.getBoundingClientRect();
    /* App artwork can contain accessible/overlay text equal to the game name.
       Only the native label-band instance belongs to the visibility controls;
       marking artwork text made transition probes and hide-name rules treat
       it as a second title. */
    if (expectedName && text === expectedName && rect.top >= labelBoundary) {
      node.classList.add("ds-native-game-name");
      continue;
    }
    if (rect.top >= labelBoundary && rect.height <= 40) {
      let line = node;
      while (line.parentElement && line.parentElement !== host) {
        const parent = line.parentElement;
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.height > 42 || normalizedText(parent.textContent).includes(expectedName)) break;
        line = parent;
      }
      line.classList.add("ds-native-status-line");
    }
  }

  for (const node of Array.from(host.querySelectorAll<HTMLElement>("*"))) {
    const text = normalizedText(node.textContent);
    if (text === "new" || text === "new to library") node.classList.add("ds-native-new-badge");
    if (/^-?\d+%$/.test(text)) node.classList.add("ds-native-discount-badge");
  }
}

export function NativeGameCard({
  item,
  featured,
  cardW,
  cardH,
  nativeItemLeft = 0,
  nativeCarouselWidth,
  suppressNativeLabel = false,
  friendsOverlay: _friendsOverlay = false,
  previewMode = false,
  hideStatusLine = false,
  hideNewBadge = false,
  hideDiscountBadge = false,
  hideCompatIcons = false,
  hideNonSteamBadge = false,
  hideGameName = false,
  hideInstallIndicator = false,
  gameNamePosition = "left",
  playtimePosition = "left",
  removableSet,
  onRemoveCard,
  hiddenSet,
  onHideCard,
  fallback,
}: NativeGameCardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const matcherRef = useRef(createMatcherState());
  const [focused, setFocused] = useState(false);
  const [gamepadFocused, setGamepadFocused] = useState(false);
  const resolution = useNativeCapsuleResolution();
  const doc = getPreferredSteamDocument();
  const appid = typeof item.id === "number" ? item.id : Number(item.appid ?? 0);
  const overview = useMemo(() => appid ? getAppOverview(doc, appid) : null, [appid, doc]);
  const eligible = !previewMode && !!appid && !!overview && !!resolution;

  useEffect(() => {
    if (!eligible) return;
    const host = hostRef.current;
    if (!host) return;

    // Steam's GamepadUI focus manager can move focus inside the borrowed
    // capsule without React delivering a synthetic focus event to our host.
    // Mirror the real DOM/class state so bShowAsHovered always follows the
    // native card's actual controller focus.
    const syncFocused = () => {
      const hasGamepadFocus = !!host.querySelector(".gpfocus");
      setGamepadFocused(hasGamepadFocus);
      setFocused(host.matches(":focus-within") || hasGamepadFocus);
    };
    const syncAfterFocusMove = () => queueMicrotask(syncFocused);
    host.addEventListener("focusin", syncFocused);
    host.addEventListener("focusout", syncAfterFocusMove);
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(syncFocused)
      : null;
    observer?.observe(host, { subtree: true, attributes: true, attributeFilter: ["class"] });
    syncFocused();
    return () => {
      host.removeEventListener("focusin", syncFocused);
      host.removeEventListener("focusout", syncAfterFocusMove);
      observer?.disconnect();
    };
  }, [eligible]);

  useLayoutEffect(() => {
    if (!eligible) return;
    const host = hostRef.current;
    if (!host) return;
    // `cardH` is the artwork boundary. The host now occupies the complete
    // native item height, so using host.height here would misclassify the
    // title/status band that begins below the artwork.
    const annotate = () => annotateNativeCard(host, item.name ?? "", cardH);
    annotate();
    const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(annotate) : null;
    observer?.observe(host, { subtree: true, childList: true, characterData: true });
    /* The first visible native cards can mount before Steam's runtime class
       map is published. Their DOM may then remain stable, so the mutation
       observer never gets another chance to mark nativeLabelOuter. Retry for
       a short bounded window and stop as soon as the original label is found. */
    const timerWindow = host.ownerDocument.defaultView ?? window;
    let retryCount = 0;
    const markerRetry = timerWindow.setInterval(() => {
      if (host.querySelector(".ds-native-game-info-root") || retryCount++ >= 11) {
        timerWindow.clearInterval(markerRetry);
        return;
      }
      annotate();
    }, 250);
    return () => {
      observer?.disconnect();
      timerWindow.clearInterval(markerRetry);
    };
  }, [eligible, item.name, cardH]);

  useEffect(() => {
    if (!eligible || !appid) return;
    return subscribeControllerInput((event) => {
      if (!event.pressed) return;
      const host = hostRef.current;
      if (!host || (!host.classList.contains("gpfocus") && !host.querySelector(".gpfocus") && !host.matches(":focus-within"))) return;
      try {
        const bindings = resolveBindings(getCurrentSettings()?.buttonBindings as any, (getCurrentSettings() as any)?.buttonBindingsDisabled);
        const state = matcherRef.current;
        const evtLike = { button: event.button };
        if (matchEvent(evtLike, parseRawCombo(bindings.cardQuickLaunch), state)) {
          host.querySelector<HTMLElement>('[role="link"]')?.click();
          return;
        }
        if (matchEvent(evtLike, parseRawCombo(bindings.cardHideRemove), state)) {
          if (removableSet?.has(appid) && onRemoveCard) onRemoveCard(appid);
          else if (onHideCard) onHideCard(appid);
          return;
        }
        if (matchEvent(evtLike, parseRawCombo(bindings.cardHighlightToggle), state)) {
          const settings = getCurrentSettings();
          const shelfId = item.shelfId;
          if (!settings || !shelfId) return;
          const shelf = settings.shelves?.find((entry) => entry.id === shelfId);
          if (!shelf) return;
          const ids = shelf.highlightedAppIds ?? [];
          const selected = ids.includes(appid) || !!shelf.highlightAll;
          void saveSettings(patchShelfInSettings(settings, shelfId, {
            highlightedAppIds: selected ? ids.filter((id) => id !== appid) : [...ids, appid],
            ...(shelf.highlightAll ? { highlightAll: false } : {}),
          }));
        }
      } catch {}
    });
  }, [eligible, appid, item.shelfId, removableSet, onRemoveCard, onHideCard]);

  if (!eligible || !resolution || !overview) return fallback;

  const NativeCard = resolution.component;
  const cssW = `var(${featured ? "--ds-eff-feat-w" : "--ds-eff-card-w"}, ${cardW}px)`;
  /* Steam's carousel owns mouse-hover reveal through its native :hover
     selector. Only force the selected state for controller focus, and let the
     carousel suppress that focused title while another card owns hover. */
  const active = shouldShowNativeCardAsHovered(
    focused,
    gamepadFocused,
    suppressNativeLabel,
  );
  const carouselWidth = Math.max(cardW, nativeCarouselWidth ?? doc?.documentElement?.clientWidth ?? cardW);
  const nativeHeight = cardH + resolution.labelHeight;

  return (
    <div
      ref={hostRef}
      className={`ds-card ds-card--native${featured ? " ds-card--featured" : ""}${focused ? " gpfocus is-selected" : ""}`}
      data-appid={appid}
      data-shelfid={item.shelfId || undefined}
      data-name={item.name || undefined}
      data-ds-native-card="true"
      data-ds-hidden={hiddenSet?.has(appid) ? "true" : undefined}
      data-ds-hide-game-name={hideGameName ? "true" : undefined}
      data-ds-hide-status={hideStatusLine ? "true" : undefined}
      data-ds-hide-new-badge={hideNewBadge ? "true" : undefined}
      data-ds-hide-discount-badge={hideDiscountBadge ? "true" : undefined}
      data-ds-hide-compat={hideCompatIcons ? "true" : undefined}
      data-ds-hide-non-steam={hideNonSteamBadge ? "true" : undefined}
      data-ds-hide-install={hideInstallIndicator ? "true" : undefined}
      data-ds-game-name-position={gameNamePosition}
      data-ds-playtime-position={playtimePosition}
      data-ds-suppress-native-label={suppressNativeLabel ? "true" : undefined}
      tabIndex={-1}
      onFocus={(event: any) => {
        if (event.target === event.currentTarget) {
          ((event.currentTarget as HTMLElement).querySelector('[role="link"]') as HTMLElement | null)?.focus();
        }
      }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event: any) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      style={{ position: "relative", width: cssW, minWidth: cssW, height: nativeHeight, flexShrink: 0, overflow: "visible" }}
    >
      <div className="ds-native-card-complete" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <NativeCard
          appid={appid}
          bFeatured={featured}
          bShortLayout={false}
          nWidth={cardW}
          nHeight={nativeHeight}
          nLeft={nativeItemLeft}
          nCarouselWidth={carouselWidth}
          onItemFocus={(_focusedAppid: number, isFocused?: boolean) => setFocused(isFocused !== false)}
          onItemHover={() => {}}
          showAsHovered={active}
        />
      </div>
    </div>
  );
}

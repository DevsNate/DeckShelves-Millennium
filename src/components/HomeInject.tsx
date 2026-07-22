import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShelfView } from "./Shelf";
import { DebugOverlay } from "./DebugOverlay";
import { isDebugOverlayEnabled } from "../runtime/debugOverlay";
import type { Settings, Shelf, SmartShelf, SmartShelfMode } from "../types";
import { refreshSettings, subscribeSettings, saveSettings, getCurrentSettings } from "../settingsStore";
import { useContainerDragReorder } from "../core/reorder";
import { PlatformProvider } from "../runtime/platformContext";
import { createDeckyPlatform } from "../runtime/deckyPlatform";
import { logInfo, logWarn } from "../runtime/logger";
import { getPreferredSteamDocument, getAllSteamDocuments } from "../runtime/steamHost";
import { ROOT_ID, seededShuffle } from "./home/mountUtils";
import { applyHideRecents, applyHideHomeTabs, getMountFailed } from "../runtime/homePatch";
import { getRecentsReplaceFailed, subscribeRecentsReplaceFailed, isRecentsReplaceInjecting, subscribeRecentsReplaceInjecting, getRecentsReplaceActiveShelfId } from "../runtime/recentsReplace";
import { Focusable } from "../runtime/host/decky";
import { installPassiveMenuHook, installPassiveShowContextMenuHook, installLibraryContextMenuPatch, installCreateContextMenuPatch } from "../core/steamGameMenu";
import { patchMenuButton } from "./home/navPatches";
import { triggerShelfRefresh } from "../core/shelfRefresh";
import { pickFirstVisibleShelfId, interleaveSmartShelves, applyAutoPin } from "../domain/shelfOrder";
import { evalVisibility, nextVisibilityFlip, getModeVisibilityWindows, invalidateSmartShelfCache } from "../steam/smartShelves";
import { subscribeDeviceState } from "../runtime/deviceState";
import { subscribeSessionState } from "../runtime/sessionState";
import { subscribePerfState, stopFrameSampler } from "../runtime/perfState";
import { subscribePeripheralsState } from "../runtime/peripheralsState";
import { flowChildrenProps, isMillenniumNavigationRuntime } from "../core/steamOSVersion";
import { isCssLoaderActive, getNativeRecentsClassName, isArtHeroActive, isNoHeroGradientActive, isHeroFullscreenActive, isNoHomeTextActive, isFocusRoundCompatActive, isTiltedHomeActive, getTiltedHomeMode } from "../core/cssLoaderDetect";
import { BadgeFocusOverlay } from "./shelf/BadgeFocusOverlay";
import { FriendsAvatarOverlay } from "./shelf/FriendsAvatarOverlay";
import { installRecentsTitleFade } from "../core/recentsTitleFade";
import { installNativeTitleInteractionOwner } from "../core/nativeTitleInteractionOwner";

const homePlatform = createDeckyPlatform();

const SURPRISE_MODES: SmartShelfMode[] = [
  "daily_pick", "deck_picks", "on_deck", "recently_played", "long_session",
  "random_pick", "not_started", "best_unplayed", "quick_play", "interrupted",
  "non_steam", "spare_time", "time_of_day", "rediscover", "forgotten",
];

// Mount + anchor + home-detection helpers live in ./home/mountUtils.

export function HomeShelves() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  const inlineMountRef = useCallback((node: HTMLDivElement | null) => {
    setMountEl(node);
  }, []);


  useEffect(() => {
    if (!mountEl) return;
    let alive = true;
    mountEl.dataset.deckShelvesRenderer = 'react';
    const applyBodyClasses = (s: any) => {
      try {
        document.body?.classList?.toggle('ds-hide-non-steam-badges', s?.globalHideNonSteamBadge === true);
      } catch {}
    };
    const unsub = subscribeSettings((s) => { if (alive) { setSettings(s); applyBodyClasses(s); } });
    refreshSettings().then((s) => { if (alive) { setSettings(s); applyBodyClasses(s); } }).catch(() => undefined);

    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && alive) { setSettings(detail); applyBodyClasses(detail); }
    };
    globalThis.addEventListener("deck-shelves-settings-changed", onSettingsChanged);

    return () => {
      alive = false;
      unsub();
      globalThis.removeEventListener("deck-shelves-settings-changed", onSettingsChanged);
      try { document.body.classList.remove('ds-hide-non-steam-badges'); } catch {}
      delete mountEl.dataset.deckShelvesRenderer;
    };
  }, [mountEl]);

  useEffect(() => {
    if (!mountEl) return;
    return installNativeTitleInteractionOwner(mountEl);
  }, [mountEl]);

  /* Apply hideRecents — only actually hide when the plugin is enabled and has
     visible shelves.  Otherwise force recents visible regardless of the toggle
     (we never change the stored setting, only the DOM state).

     When `recentsReplaceSource` is on, the native recents area remains */
  /* visible on purpose — our router patch is driving its games array — so
     the visual hide is skipped. First visible shelf is forced-expanded only
     when we're truly hiding (preserves the current behaviour).
     Re-run this effect when the recents-replace kill switch flips (our
     experiment reported a runtime error → fall back to the visual hide). */
  const [replaceKillSwitch, setReplaceKillSwitch] = useState(() => getRecentsReplaceFailed());
  useEffect(() => {
    const sync = () => setReplaceKillSwitch(getRecentsReplaceFailed());
    const unsub = subscribeRecentsReplaceFailed(sync);
    sync();
    return unsub;
  }, []);
  const [replaceInjecting, setReplaceInjecting] = useState(() => isRecentsReplaceInjecting());
  useEffect(() => {
    const sync = () => setReplaceInjecting(isRecentsReplaceInjecting());
    const unsub = subscribeRecentsReplaceInjecting(sync);
    sync();
    return unsub;
  }, []);

  useEffect(() => {
    const visibleShelves = (settings?.shelves ?? []).filter((s: any) => s.enabled && !s.hidden);
    const visibleSmartCount = settings?.smartShelvesEnabled
      ? (settings?.smartShelves ?? []).filter((s: any) =>
          s.enabled !== false && !s.hidden && evalVisibility(s)
        ).length
      : 0;
    const hasAnyVisible = visibleShelves.length > 0 || visibleSmartCount > 0;
    const replaceActive = settings?.enabled && settings?.hideRecents === true
      && settings?.recentsReplaceSource === true && hasAnyVisible
      && !replaceKillSwitch;
    const canHide = settings?.enabled && settings?.hideRecents === true
      && hasAnyVisible && !replaceActive;
    applyHideRecents(canHide === true);
  }, [settings?.hideRecents, settings?.enabled, settings?.shelves, settings?.smartShelvesEnabled, settings?.smartShelves, settings?.recentsReplaceSource, mountEl, replaceKillSwitch]);

  // Apply hideHomeTabs — no suppression criteria, simple toggle. If no sibling
  // elements are found around the mount, the helper is a no-op.
  useEffect(() => {
    applyHideHomeTabs(settings?.hideHomeTabs === true);
  }, [settings?.hideHomeTabs, mountEl]);

  /* Schedule a one-shot refresh at the next visibility-window boundary across
     all smart shelves. Picks the earliest boundary; on fire, invalidates
     resolver caches for time-aware shelves, forces HomeInject to re-render
     (so evalVisibility is re-evaluated), then triggers shelf refresh.
     Re-armed on each fire (visibilityTick dep) and on smart-shelf list changes. */
  const [visibilityTick, setVisibilityTick] = useState(0);
  const smartList = settings?.smartShelves;
  useEffect(() => {
    if (!settings?.smartShelvesEnabled) return;
    if (!Array.isArray(smartList) || smartList.length === 0) return;
    const now = new Date();
    const { earliest, timeAwareIds } = computeEarliestFlip(smartList, now);
    if (earliest == null) return;
    const delay = Math.max(1000, earliest - now.getTime());
    const t = window.setTimeout(() => {
      for (const id of timeAwareIds) invalidateSmartShelfCache(id);
      setVisibilityTick((n) => n + 1);
      try { triggerShelfRefresh(); } catch {}
    }, delay);
    return () => window.clearTimeout(t);
  }, [settings?.smartShelvesEnabled, smartList, visibilityTick]);

  const [, setDeviceTick] = useState(0);
  useEffect(() => {
    const bump = () => setDeviceTick((n) => n + 1);
    const unDevice = subscribeDeviceState(bump);
    const unSession = subscribeSessionState(bump);
    const unPerf = subscribePerfState(bump);
    const unPeripherals = subscribePeripheralsState(bump);
    return () => { unDevice(); unSession(); unPerf(); unPeripherals(); stopFrameSampler(); };
  }, []);

  const inlineHost = (children?: any) => (
    <div
      id={ROOT_ID}
      ref={inlineMountRef}
      data-deck-shelves-native-mount="1"
      style={{ width: "100%", display: "block", position: "relative", zIndex: 0, margin: "0 0 24px", padding: "0 0 8px" }}
    >
      {children}
    </div>
  );

  if (!mountEl) return inlineHost();
  if (!settings) return inlineHost();

  // Crash protection: don't attempt to render if mounting has failed
  if (getMountFailed()) {
    logWarn("HOME", "mount failed — skipping render");
    return inlineHost();
  }

  const visibleShelves = (settings.shelves ?? []).filter((s) => s.enabled && !s.hidden);

  /* When replace-source is actively injecting (toggle on + app ids resolved
     + not killed), the injected shelf is already rendering inside the native
     recents slot. Skip it here to avoid a visual duplicate below. If the
     injection isn't happening (failed, not resolved yet), keep every shelf. */
  const normalShelves = (replaceInjecting && !replaceKillSwitch)
    ? (() => {
        const activeId = getRecentsReplaceActiveShelfId();
        return activeId
          ? visibleShelves.filter((s) => s.id !== activeId)
          : visibleShelves.slice(1);
      })()
    : visibleShelves;

  // Convert enabled smart shelves to Shelf-compatible objects for ShelfView.
  let smartShelves: Shelf[] = [];
  if (settings.smartShelvesEnabled) {
    if (settings.smartSurpriseMe) {
      const _now = new Date();
      const dayIndex = _now.getFullYear() * 10000 + (_now.getMonth() + 1) * 100 + _now.getDate();
      const rawCount = settings.smartSurpriseMeCount ?? 0;
      const count = rawCount > 0 ? rawCount : (1 + (dayIndex % 3));
      const selected = seededShuffle(SURPRISE_MODES, dayIndex).slice(0, count);
      smartShelves = selected.map((mode): Shelf => ({
        id: `surprise_${mode}`,
        title: t(`smart_template_${mode}` as any),
        enabled: true,
        hidden: false,
        limit: 20,
        matchNativeSize: false,
        highlightFirst: false,
        highlightAll: false,
        hideStatusLine: false,
        hideNewBadge: false,
        hideDiscountBadge: false,
        hideCompatIcons: false,
        hideNonSteamBadge: false,
        hideShelfTitle: false,
        hideGameNames: false,
        hideInstallIndicator: false,
        hideSeeMore: false,
        hideRefreshCard: false,
        source: { type: "smart", mode },
      }));
    } else {
      smartShelves = (settings.smartShelves ?? [])
        .filter((s: SmartShelf) => s.enabled && !s.hidden)
        .filter((s: SmartShelf) =>
          evalVisibility({
            visibility: (s as any).visibility,
            visibleHours: (s as any).visibleHours ?? getModeVisibilityWindows((s as any).mode),
            visibleDaysOfWeek: (s as any).visibleDaysOfWeek,
          } as any)
        )
        .map((s: SmartShelf): Shelf => ({
          id: s.id,
          title: s.title,
          enabled: true,
          hidden: false,
          limit: s.limit ?? 20,
          matchNativeSize: (s as any).matchNativeSize ?? false,
          highlightFirst: (s as any).highlightFirst ?? false,
          highlightAll: (s as any).highlightAll ?? false,
          highlightedAppIds: (s as any).highlightedAppIds,
          hideStatusLine: (s as any).hideStatusLine ?? false,
          hideNewBadge: (s as any).hideNewBadge ?? false,
          hideDiscountBadge: (s as any).hideDiscountBadge ?? false,
          hideCompatIcons: (s as any).hideCompatIcons ?? false,
          hideNonSteamBadge: (s as any).hideNonSteamBadge ?? false,
          hideShelfTitle: (s as any).hideShelfTitle ?? false,
          friendsPlayingOverlay: (s as any).friendsPlayingOverlay ?? false,
          friendsPlayingOverlayRecent: (s as any).friendsPlayingOverlayRecent ?? false,
          ...((s as any).heroEnabled ? { heroEnabled: true } : {}) as any,
          source: {
            type: "smart",
            mode: s.mode,
            filterGroup: (s as any).filterGroup,
            smartParams: (s as any).smartParams,
            refreshIntervalMinutes: (s as any).refreshIntervalMinutes,
            // Composite source mixing — forwarded so the resolver can union /
            // intersect multiple smart-mode candidate sets when the user has
            // configured a composite shelf.
            compositeModes: (s as any).compositeModes,
            compositeCombine: (s as any).compositeCombine,
            // friends_playing may surface games the user doesn't own (friends
            /* currently playing OR seen playing in last 14 days). This flag
               tells Shelf.tsx to fall back to the Steam Store API for names +
               covers on non-owned appids (same path wishlist / store shelves
               already use). Owned appids continue to render from local
               appStore metadata as usual. */
            includesNonOwned: s.mode === 'friends_playing' || Array.isArray((s as any).compositeModes) && (s as any).compositeModes.includes('friends_playing'),
          } as any,
          // Surface user-configured overrides so resolveShelfAppIds +
          // Shelf.tsx can apply them on top of the mode's candidates.
          sort: (s as any).sort,
          manualOrder: (s as any).manualOrder,
          manualBaseSort: (s as any).manualBaseSort,
        } as any));
    }
  }

  /* Placement:
     - unifiedListEnabled: emit shelves in explicit `allShelvesOrder` (user's
       reorder; unlisted fall to the end), skipping the interleave/order-css path.
     - atBottom: normal then smart. hideRecents + !replace: normal then smart in
       DOM with CSS `order` restoring interleave. else: smart then normal. */
  const unifiedOn = (settings as any).unifiedListEnabled === true;
  const allShelvesOrder: string[] = ((settings as any).allShelvesOrder ?? []) as string[];
  const normalFirst = settings.smartShelvesAtBottom
    || (settings.hideRecents === true && !(replaceInjecting && !replaceKillSwitch));
  let shelves: Shelf[];
  if (unifiedOn) {
    const combined = [...normalShelves, ...smartShelves];
    const byId = new Map(combined.map((s) => [s.id, s] as const));
    const ordered: Shelf[] = [];
    for (const id of allShelvesOrder) {
      const found = byId.get(id);
      if (found) { ordered.push(found); byId.delete(id); }
    }
    // Append anything the user has but hasn't placed yet (new shelves).
    for (const remaining of byId.values()) ordered.push(remaining);
    shelves = ordered;
  } else {
    shelves = normalFirst
      ? [...normalShelves, ...smartShelves]
      : [...smartShelves, ...normalShelves];
  }

  /* Auto-pin: float shelves whose `autoPin` predicate currently matches to the
     top (stable, opt-in — untouched when nothing is pinned). Re-evaluated on the
     device/session tick, same as visibility rules. */
  shelves = applyAutoPin(shelves, (s) => {
    const ap = (s as any).autoPin;
    return !!ap && Array.isArray(ap.rules) && ap.rules.length > 0 && evalVisibility({ visibility: ap } as any);
  }) as Shelf[];

  // Visual interleave mode: when hiding recents AND the user did NOT request
  /* smart-shelves-at-bottom, we render [normal..., smart...] in the DOM but
     present them visually as [promoted normal, smart, rest of normal] via
     flex `order`. When `smartShelvesAtBottom=true`, the user explicitly
     wants smart at the end — no reorder needed, the array order matches.
     Disabled entirely in unified mode (user-defined order is authoritative). */
  const interleaveSmart = !unifiedOn
    && settings.hideRecents === true
    && !settings.smartShelvesAtBottom
    && !(replaceInjecting && !replaceKillSwitch);

  // When the plugin is disabled, there are no visible shelves, or all shelves
  // are hidden — always ensure recents are visible regardless of the toggle
  // value (we never force-change the setting, just override the DOM state).
  if (!settings.enabled || !visibleShelves.length) {
    applyHideRecents(false);
    if (!settings.enabled) logWarn("HOME", "plugin disabled — recents forced visible");
    return inlineHost();
  }
  logInfo("HOME", "rendering shelves in native Home tree", { visible: shelves.length, mountConnected: mountEl.isConnected });

  const content = (
    <PlatformProvider platform={homePlatform}>
      <ShelvesContainer mountEl={mountEl} shelves={shelves} globalMatchNativeSize={settings.globalMatchNativeSize === true} globalHighlightFirst={settings.globalHighlightFirst === true} globalHighlightAll={settings.globalHighlightAll === true} globalHighlightRandom={(settings as any).globalHighlightRandom === true} globalHideStatusLine={settings.globalHideStatusLine === true} globalHideNewBadge={settings.globalHideNewBadge === true} globalHideDiscountBadge={(settings as any).globalHideDiscountBadge === true} globalHideCompatIcons={settings.globalHideCompatIcons === true} globalHideNonSteamBadge={settings.globalHideNonSteamBadge === true} globalHideShelfTitle={settings.globalHideShelfTitle === true} globalHideGameNames={settings.globalHideGameNames === true} globalHideInstallIndicator={settings.globalHideInstallIndicator === true} globalHideSeeMore={settings.globalHideSeeMore === true} globalHideRefreshCard={settings.globalHideRefreshCard === true} globalDedupeByName={(settings as any).globalDedupeByName === true} globalHeroEnabled={(settings as any).globalHeroEnabled === true} globalGameInfoAbove={(settings as any).globalGameInfoAbove === true} globalFriendsPlayingOverlay={(settings as any).globalFriendsPlayingOverlay === true} globalFriendsPlayingOverlayRecent={(settings as any).globalFriendsPlayingOverlayRecent === true} globalEnableLogo={(settings as any).globalEnableLogo === true} globalEnableIcon={(settings as any).globalEnableIcon === true} globalEnableDescription={(settings as any).globalEnableDescription === true} globalDescriptionBelowLogo={(settings as any).globalDescriptionBelowLogo === true} globalLogoBelowShelf={(settings as any).globalLogoBelowShelf === true} globalLogoPosition={(((settings as any).globalLogoPosition === 'center' || (settings as any).globalLogoPosition === 'right') ? (settings as any).globalLogoPosition : 'left')} globalDescriptionPosition={(((settings as any).globalDescriptionPosition === 'center' || (settings as any).globalDescriptionPosition === 'right') ? (settings as any).globalDescriptionPosition : 'left')} globalLogoSize={(typeof (settings as any).globalLogoSize === 'number' ? Math.max(50, Math.min(200, (settings as any).globalLogoSize)) : 100)} globalLogoTopOffset={(typeof (settings as any).globalLogoTopOffset === 'number' ? Math.max(0, Math.min(100, (settings as any).globalLogoTopOffset)) : 20)} globalFullPageShelf={(settings as any).globalFullPageShelf === true} keepShelvesStacked={settings.keepShelvesStacked !== false} globalIconVerticalAlign={(settings as any).globalIconVerticalAlign} globalShelfTitlePosition={(settings as any).globalShelfTitlePosition} globalGameNamePosition={(settings as any).globalGameNamePosition} globalPlaytimePosition={(settings as any).globalPlaytimePosition} globalDescriptionHeight={(settings as any).globalDescriptionHeight} shelfHeroBackground={settings.hideRecents === true && settings.shelfHeroBackground === true && !(replaceInjecting && !replaceKillSwitch)} perShelfHeroAllowed={!(replaceInjecting && !replaceKillSwitch)} hideRecentsSetting={settings.hideRecents === true && (settings.recentsReplaceSource !== true || replaceKillSwitch)} forceCssLoaderThemes={settings.forceCssLoaderThemes === true} fadeRecentsTitle={settings.fadeRecentsTitle === true} interleaveSmart={interleaveSmart} />
      {isDebugOverlayEnabled(settings) ? <DebugOverlay mountEl={mountEl} shelves={shelves} /> : null}
    </PlatformProvider>
  );
  return inlineHost(content);
}

function computeEarliestFlip(smartList: any[], now: Date): { earliest: number | null; timeAwareIds: string[] } {
  let earliest: number | null = null;
  const timeAwareIds: string[] = [];
  for (const shelf of smartList) {
    const visibleHours = shelf.visibleHours ?? getModeVisibilityWindows(shelf.mode);
    const next = nextVisibilityFlip({
      visibility: shelf.visibility,
      visibleHours,
      visibleDaysOfWeek: shelf.visibleDaysOfWeek,
    }, now);
    if (next == null) continue;
    timeAwareIds.push(shelf.id);
    if (earliest == null || next < earliest) earliest = next;
  }
  return { earliest, timeAwareIds };
}

function computeAutoCollapse(shelf: any, enabled: boolean): { forceCollapsed: boolean; autoCollapseWhenEmpty: boolean } {
  if (!enabled) return { forceCollapsed: false, autoCollapseWhenEmpty: false };
  const autoCollapse = shelf.autoCollapse;
  const forceCollapsed = !!autoCollapse
    && Array.isArray(autoCollapse.rules)
    && autoCollapse.rules.length > 0
    && evalVisibility({ visibility: autoCollapse } as any);
  return { forceCollapsed, autoCollapseWhenEmpty: shelf.autoCollapseWhenEmpty === true };
}

function ShelvesContainer({ mountEl, shelves, globalMatchNativeSize = false, globalHighlightFirst = false, globalHighlightAll = false, globalHighlightRandom = false, globalHideStatusLine = false, globalHideNewBadge = false, globalHideDiscountBadge = false, globalHideCompatIcons = false, globalHideNonSteamBadge = false, globalHideShelfTitle = false, globalHideGameNames = false, globalHideInstallIndicator = false, globalHideSeeMore = false, globalHideRefreshCard = false, globalDedupeByName = false, globalHeroEnabled = false, globalGameInfoAbove = false, globalFriendsPlayingOverlay = false, globalFriendsPlayingOverlayRecent = false, globalEnableLogo = false, globalEnableIcon = false, globalEnableDescription = false, globalDescriptionBelowLogo = false, globalLogoBelowShelf = false, globalLogoPosition = 'left', globalDescriptionPosition = 'left', globalLogoSize = 100, globalLogoTopOffset = 20, globalFullPageShelf = false, keepShelvesStacked = true, globalIconVerticalAlign, globalShelfTitlePosition, globalGameNamePosition, globalPlaytimePosition, globalDescriptionHeight, shelfHeroBackground = false, perShelfHeroAllowed = false, hideRecentsSetting = false, forceCssLoaderThemes = false, fadeRecentsTitle = false, interleaveSmart = false }: { mountEl: HTMLElement; shelves: any[]; globalMatchNativeSize?: boolean; globalHighlightFirst?: boolean; globalHighlightAll?: boolean; globalHighlightRandom?: boolean; globalHideStatusLine?: boolean; globalHideNewBadge?: boolean; globalHideDiscountBadge?: boolean; globalHideCompatIcons?: boolean; globalHideNonSteamBadge?: boolean; globalHideShelfTitle?: boolean; globalHideGameNames?: boolean; globalHideInstallIndicator?: boolean; globalHideSeeMore?: boolean; globalHideRefreshCard?: boolean; globalDedupeByName?: boolean; globalHeroEnabled?: boolean; globalGameInfoAbove?: boolean; globalFriendsPlayingOverlay?: boolean; globalFriendsPlayingOverlayRecent?: boolean; globalEnableLogo?: boolean; globalEnableIcon?: boolean; globalEnableDescription?: boolean; globalDescriptionBelowLogo?: boolean; globalLogoBelowShelf?: boolean; globalLogoPosition?: 'left' | 'center' | 'right'; globalDescriptionPosition?: 'left' | 'center' | 'right'; globalLogoSize?: number; globalLogoTopOffset?: number; globalFullPageShelf?: boolean; keepShelvesStacked?: boolean; globalIconVerticalAlign?: 'top' | 'center' | 'bottom' | null; globalShelfTitlePosition?: 'left' | 'center' | 'right' | null; globalGameNamePosition?: 'left' | 'center' | 'right' | null; globalPlaytimePosition?: 'left' | 'center' | 'right' | null; globalDescriptionHeight?: number | null; shelfHeroBackground?: boolean; perShelfHeroAllowed?: boolean; hideRecentsSetting?: boolean; forceCssLoaderThemes?: boolean; fadeRecentsTitle?: boolean; interleaveSmart?: boolean }) {
  const autoCollapseEnabled = getCurrentSettings()?.autoCollapseEnabled === true;
  useEffect(() => {
    try { patchMenuButton(); } catch (e) { logInfo("HOME", "patchMenuButton failed", String(e)); }
    try { installPassiveMenuHook(); } catch (e) { logInfo("HOME", "installPassiveMenuHook failed", String(e)); }
    try { installPassiveShowContextMenuHook(); } catch (e) { logInfo("HOME", "installPassiveShowContextMenuHook failed", String(e)); }
    try { installLibraryContextMenuPatch(); } catch (e) { logInfo("HOME", "installLibraryContextMenuPatch failed", String(e)); }
    try { installCreateContextMenuPatch(); } catch (e) { logInfo("HOME", "installCreateContextMenuPatch failed", String(e)); }
    const retries = [400, 1000, 2000, 4000, 8000, 15000].map((delay) => setTimeout(() => {
      try { installLibraryContextMenuPatch(); } catch {}
      try { installCreateContextMenuPatch(); } catch {}
    }, delay));
    return () => { for (const timer of retries) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!fadeRecentsTitle) return;
    return installRecentsTitleFade(mountEl);
  }, [fadeRecentsTitle, mountEl]);

  // Monitor shelves -> if hideRecentsSetting is true but there are no visible
  // shelves or none resolve to items, force recents visible and emit disable event.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const visible = (shelves ?? []).filter((s) => s.enabled && !s.hidden);
        if (!hideRecentsSetting) {
          if (alive) globalThis.dispatchEvent(new CustomEvent('deck-shelves-hideRecents-disabled', { detail: { disabled: false } }));
          return;
        }
        if (!visible.length) {
          applyHideRecents(false);
          if (alive) globalThis.dispatchEvent(new CustomEvent('deck-shelves-hideRecents-disabled', { detail: { disabled: true } }));
          return;
        }
        const resolved = await Promise.all(visible.map((sh) => homePlatform.resolveShelfAppIds(sh.source, sh.limit).catch(() => [])));
        const anyHas = resolved.some((r) => Array.isArray(r) && r.length > 0);
        if (!anyHas) {
          applyHideRecents(false);
          if (alive) globalThis.dispatchEvent(new CustomEvent('deck-shelves-hideRecents-disabled', { detail: { disabled: true } }));
        } else {
          if (hideRecentsSetting) applyHideRecents(true);
          if (alive) globalThis.dispatchEvent(new CustomEvent('deck-shelves-hideRecents-disabled', { detail: { disabled: false } }));
        }
      } catch (e) {
        if (alive) globalThis.dispatchEvent(new CustomEvent('deck-shelves-hideRecents-disabled', { detail: { disabled: false } }));
      }
    };
    check();
    return () => { alive = false; };
  }, [shelves, hideRecentsSetting, mountEl]);


  const rootRef = useRef<HTMLDivElement>(null);

  // First rendered .ds-shelf id (tracked by MO since shelves[0] may
  // render null). Only normal shelves get the recents-slot promotion;
  // smart shelves are excluded to avoid heuristic-driven flicker.
  const [firstVisibleId, setFirstVisibleId] = useState<string | null>(null);
  useEffect(() => {
    if (!hideRecentsSetting) { setFirstVisibleId(null); return; }
    const rootEl = rootRef.current;
    if (!rootEl) return;
    // Config-order pick, not DOM-order: skip empty shelves; keep
    // stable across resolver finish-order.
    const scan = () => {
      const renderedIds = new Set(
        Array.from(rootEl.querySelectorAll<HTMLElement>('.ds-shelf[data-shelfid]'))
          .map((el) => el.getAttribute('data-shelfid'))
          .filter((id): id is string => !!id),
      );
      const pick = pickFirstVisibleShelfId(shelves ?? [], renderedIds);
      setFirstVisibleId((prev) => (prev === pick ? prev : pick));
    };
    scan();
    const obs = new MutationObserver(scan);
    obs.observe(rootEl, { childList: true, subtree: false });
    return () => obs.disconnect();
  }, [hideRecentsSetting, shelves]);

  /* CSS Loader recents-wrapper promotion. When user hides native
     recents we promote the first visible shelf into the recents
     selector space via data-ds-recents-slot + the live wrapper class.
     forceCssLoaderThemes promotes ALL shelves. Class assignment is
     additive only — invariants enforced in arthero.sh. */

  // Re-fires the recents-slot promotion when CSS Loader injects late.
  const [cssLoaderTick, setCssLoaderTick] = useState(0);

  useEffect(() => {
    // INVARIANT 1: runs when recents are hidden (first-shelf promotion) OR
    // when forceCssLoaderThemes is on — the latter promotes every shelf
    // regardless of whether the native recents shelf is kept.
    if (!hideRecentsSetting && !forceCssLoaderThemes) return;
    // INVARIANT 2: the first-shelf-only path needs firstVisibleId; the
    // force path targets every shelf so it doesn't.
    if (!firstVisibleId && !forceCssLoaderThemes) return;
    if (!isCssLoaderActive()) return;       // INVARIANT 3
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const nativeClass = getNativeRecentsClassName(mountEl);
    if (!nativeClass) return;

    /* forceCssLoaderThemes ON: promote EVERY shelf — native wrapper class +
       data-ds-recents-slot — so theme rules (Obsidian, TiltedHome, ArtHero
       hero/mask + full-page layout) reach all DS shelves, not just the first.
       OFF: only the first (promoted) shelf is promoted. */
    const applyAll = () => {
      const firstShelf = firstVisibleId
        ? rootEl.querySelector<HTMLElement>(`.ds-shelf[data-shelfid="${CSS.escape(firstVisibleId)}"]`)
        : null;
      const all = Array.from(rootEl.querySelectorAll<HTMLElement>('.ds-shelf[data-shelfid]'));
      const artHeroActive = isArtHeroActive();
      const candidates = forceCssLoaderThemes ? all : (firstShelf ? [firstShelf] : []);
      // Global compact mode keeps every Deck Shelves row out of Art Hero's
      // native Recents selector space. Other themes keep their normal path.
      const targets = artHeroActive && keepShelvesStacked ? [] : candidates;
      for (const t of targets) {
        t.classList.add(nativeClass);                                    // INVARIANT 4
        t.setAttribute('data-ds-recents-slot', 'true');
      }
    };
    applyAll();
    // Re-apply when shelves appear late (items load async → DeckRow mounts after this effect ran)
    const obs = new MutationObserver(applyAll);
    obs.observe(rootEl, { childList: true, subtree: false });
    return () => {
      obs.disconnect();
      for (const t of rootEl.querySelectorAll<HTMLElement>('.ds-shelf[data-shelfid]')) {
        try { t.removeAttribute('data-ds-recents-slot'); t.classList.remove(nativeClass); } catch {}
      }
    };
  }, [hideRecentsSetting, firstVisibleId, mountEl, forceCssLoaderThemes, keepShelvesStacked, shelves, cssLoaderTick]);

  /* Isolate Art Hero's card selectors so the theme does not resize the native
     cards rendered inside Deck Shelves. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let lastActive = isCssLoaderActive();
    const setFlag = (attr: string, on: boolean) => {
      if (on) root.setAttribute(attr, 'true');
      else root.removeAttribute(attr);
    };
    // Mirror a flag onto <html> of every reachable Steam document. Needed
    // when a rule must target an element OUTSIDE .deck-shelves-root (e.g.
    // the native FocusRing overlay, which lives in its own subtree).
    const setHtmlFlag = (attr: string, on: boolean) => {
      try {
        const docs: Document[] = [];
        const seen = new Set<Document>();
        const add = (d: Document | null | undefined) => {
          if (!d || seen.has(d)) return;
          seen.add(d);
          docs.push(d);
        };
        add(document);
        add(getPreferredSteamDocument());
        for (const d of getAllSteamDocuments()) add(d);
        for (const d of docs) {
          if (on) d.documentElement.setAttribute(attr, 'true');
          else d.documentElement.removeAttribute(attr);
        }
      } catch {}
    };
    const apply = () => {
      try {
        const artHeroActive = isArtHeroActive();
        setFlag('data-ds-art-hero-active', artHeroActive);
        setFlag('data-ds-keep-shelves-stacked', keepShelvesStacked);
        setFlag('data-ds-hero-label', false);
        // Theme flags — CSS in shelfStyles.ts scopes the visual change via
        // data-ds-recents-slot (first shelf or all under force).
        setFlag('data-ds-theme-no-hero-gradient', isNoHeroGradientActive());
        setFlag('data-ds-theme-hero-fullscreen', isHeroFullscreenActive() && !(artHeroActive && keepShelvesStacked));
        setFlag('data-ds-theme-no-home-text', isNoHomeTextActive());
        /* TiltedHome flag — when set, the shelfStyles.ts CSS gates a
           perspective + rotateY transform onto DS cards using the
           SAME `--ren-tilt-angle` (and friends) variables the theme
           exposes at `:root`, so DS shelves match the user's tilt
           intensity without us having to fork the values. */
        const tilted = isTiltedHomeActive();
        setFlag('data-ds-theme-tilted-home', tilted);
        /* TiltedHome variants — emit method + direction so shelfStyles.ts
           CSS can gate the precise transform on the actually-installed
           mode (user picks among independent CSS Loader modules). Cleared
           when TiltedHome isn't active. */
        const mode = tilted ? getTiltedHomeMode() : null;
        const setStrFlag = (attr: string, val: string | null | undefined) => {
          try {
            const doc = getPreferredSteamDocument();
            const docs = [doc, ...getAllSteamDocuments()].filter((x): x is Document => !!x);
            for (const d of docs) {
              const r = d.querySelector('.deck-shelves-root') as HTMLElement | null;
              if (r) {
                if (val) r.setAttribute(attr, val);
                else r.removeAttribute(attr);
              }
            }
          } catch {}
        };
        setStrFlag('data-ds-theme-tilt-method', mode?.method ?? null);
        setStrFlag('data-ds-theme-tilt-direction', mode?.direction ?? null);
        const roundCompat = isFocusRoundCompatActive();
        setFlag('data-ds-theme-focus-round-compat', roundCompat);
        // Mirror to <html> so the FocusRing suppression rule can reach the
        // FocusRing element (which sits outside .deck-shelves-root).
        setHtmlFlag('data-ds-theme-focus-round-compat', roundCompat);
        // Force-themes flag — gates theme rules that should only engage
        // under force (e.g. No Home Text per user spec).
        setFlag('data-ds-force-themes', forceCssLoaderThemes);
        // Recents-hidden flag — gates the fullscreen-theme margin-top: -56
        // rule (only pull the first shelf up when nothing native is above).
        setFlag('data-ds-recents-hidden', hideRecentsSetting);
        // Hero-background flag — DS's own fullscreen hero (shelfHeroBackground)
        // also needs the -56 pull-up to cover the header band, even without a
        // CSS Loader fullscreen-hero theme.
        setFlag('data-ds-hero-background', shelfHeroBackground);
        const nowActive = isCssLoaderActive();
        if (nowActive && !lastActive) setCssLoaderTick((v) => v + 1);
        lastActive = nowActive;
      } catch {}
    };
    apply();
    /* Observe every known Steam doc's head — CSS Loader injects theme styles
       into the BigPicture head, which may not be the preferred doc. A single
       observer on preferred.head misses those mutations and leaves
       data-ds-hero-label stale when themes toggle mid-session. */
    const observers: MutationObserver[] = [];
    const seen = new Set<Element>();
    const observeHead = (d: Document | null | undefined) => {
      const head = d?.head ?? d?.documentElement;
      if (!head || seen.has(head)) return;
      seen.add(head);
      const o = new MutationObserver(apply);
      o.observe(head, { childList: true });
      observers.push(o);
    };
    observeHead(getPreferredSteamDocument());
    for (const d of getAllSteamDocuments()) observeHead(d);
    return () => {
      for (const o of observers) { try { o.disconnect(); } catch {} }
      try {
        root.removeAttribute('data-ds-hero-label');
        root.removeAttribute('data-ds-art-hero-active');
        root.removeAttribute('data-ds-keep-shelves-stacked');
        root.removeAttribute('data-ds-theme-no-hero-gradient');
        root.removeAttribute('data-ds-theme-hero-fullscreen');
        root.removeAttribute('data-ds-theme-no-home-text');
        root.removeAttribute('data-ds-theme-tilted-home');
        root.removeAttribute('data-ds-theme-focus-round-compat');
        root.removeAttribute('data-ds-force-themes');
        root.removeAttribute('data-ds-recents-hidden');
      } catch {}
      setHtmlFlag('data-ds-theme-focus-round-compat', false);
    };
  }, [mountEl, forceCssLoaderThemes, hideRecentsSetting, shelfHeroBackground, globalHeroEnabled, keepShelvesStacked]);

  /* Drag-to-reorder shelves by holding the title (touch/mouse only; D-pad nav
     stays untouched). The hook scopes to `.ds-shelf[data-shelfid]` under the
     root container and only acts on ids that match REGULAR shelves in
     settings (smart shelves are position-managed separately via their toggle). */
  useContainerDragReorder<string>({
    containerRef: rootRef,
    itemSelector: '.ds-shelf[data-shelfid]',
    getItemId: (el) => {
      const id = el.getAttribute('data-shelfid');
      if (!id) return null;
      const s = getCurrentSettings();
      return s?.shelves?.some((sh: any) => sh.id === id) ? id : null;
    },
    getOrder: () => {
      const s = getCurrentSettings();
      return (s?.shelves ?? []).map((sh: any) => sh.id as string);
    },
    onReorder: (newIds) => {
      const s = getCurrentSettings();
      if (!s) return;
      const map = new Map(s.shelves.map((sh: any) => [sh.id, sh]));
      const next = newIds.map((id) => map.get(id)).filter(Boolean) as any[];
      for (const sh of s.shelves) if (!newIds.includes(sh.id)) next.push(sh);
      saveSettings({ ...s, shelves: next });
    },
    axis: 'vertical',
    allowedPointerTypes: ['mouse', 'touch'],
  });

  // Visual interleave: when needed, REORDER the shelves array so the DOM
  // matches the visual order. CSS `order` was tried but it doesn't move
  /* gamepad/accessibility focus — navigation followed DOM order, jumping
     from promoted to "rest of normal" without visiting smart in between.
     Reordering at React level fixes both rendering and navigation in one
     pass. Falls back to the original `shelves` array when interleave is
     off OR when `firstVisibleId` isn't yet known. */
  const orderedShelves = useMemo(() => {
    if (!interleaveSmart) return shelves;
    return interleaveSmartShelves(shelves, firstVisibleId);
  }, [shelves, interleaveSmart, firstVisibleId]);

  // Steam occasionally injects React-owned children (empty-state SVGs,
  // hint overlays) directly into our root; they show up as direct
  /* siblings of the `.ds-shelf` nodes and consume vertical space at the
     bottom of the home. Hide them so they don't expand the scroll
     height. We never remove the node — React's reconciler may still
     own its subtree — only `display: none` it, and tag with
     `data-ds-foreign` so the same observer is idempotent. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hideForeign = () => {
      for (const child of Array.from(root.children)) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.classList.contains('ds-shelf')) continue;
        if (child.getAttribute('data-ds-foreign') === 'true') continue;
        child.setAttribute('data-ds-foreign', 'true');
        child.style.display = 'none';
      }
    };
    hideForeign();
    const obs = new MutationObserver(hideForeign);
    obs.observe(root, { childList: true });
    return () => obs.disconnect();
  }, []);

  // Steam's Home navigator must see every Millennium shelf as a peer of the
  // other Home rows. A Focusable root turns the entire plugin into one opaque
  // navigation child, so use a layout-only element in Millennium. Keep the
  // Decky root unchanged for the original plugin runtime.
  const millenniumNavigation = isMillenniumNavigationRuntime();
  const RootContainer: any = millenniumNavigation ? "div" : Focusable;
  const rootNavigationProps = millenniumNavigation ? {} : flowChildrenProps("column");

  return (
    <RootContainer
      ref={rootRef}
      className="deck-shelves-root"
      {...rootNavigationProps}
      style={{ width: "100%", display: "flex", flexDirection: "column", paddingBottom: 8, marginBottom: 24, position: "relative" }}
    >
      {orderedShelves.map((shelf: any) => {
        const ac = computeAutoCollapse(shelf, autoCollapseEnabled);
        return <ShelfView key={shelf.id} shelf={shelf} forceCollapsed={ac.forceCollapsed} autoCollapseWhenEmpty={ac.autoCollapseWhenEmpty} globalMatchNativeSize={globalMatchNativeSize} globalHighlightFirst={globalHighlightFirst} globalHighlightAll={globalHighlightAll} globalHighlightRandom={globalHighlightRandom} globalHideStatusLine={globalHideStatusLine} globalHideNewBadge={globalHideNewBadge} globalHideDiscountBadge={globalHideDiscountBadge} globalHideCompatIcons={globalHideCompatIcons} globalHideNonSteamBadge={globalHideNonSteamBadge} globalHideShelfTitle={globalHideShelfTitle} globalHideGameNames={globalHideGameNames} globalHideInstallIndicator={globalHideInstallIndicator} globalHideSeeMore={globalHideSeeMore} globalHideRefreshCard={globalHideRefreshCard} globalDedupeByName={globalDedupeByName} globalHeroEnabled={globalHeroEnabled} globalGameInfoAbove={globalGameInfoAbove} globalFriendsPlayingOverlay={globalFriendsPlayingOverlay} globalFriendsPlayingOverlayRecent={globalFriendsPlayingOverlayRecent} globalEnableLogo={globalEnableLogo} globalEnableIcon={globalEnableIcon} globalEnableDescription={globalEnableDescription} globalDescriptionBelowLogo={globalDescriptionBelowLogo} globalLogoBelowShelf={globalLogoBelowShelf} globalLogoPosition={globalLogoPosition} globalDescriptionPosition={globalDescriptionPosition} globalLogoSize={globalLogoSize} globalLogoTopOffset={globalLogoTopOffset} globalFullPageShelf={globalFullPageShelf} globalIconVerticalAlign={globalIconVerticalAlign} globalShelfTitlePosition={globalShelfTitlePosition} globalGameNamePosition={globalGameNamePosition} globalPlaytimePosition={globalPlaytimePosition} globalDescriptionHeight={globalDescriptionHeight} heroForced={perShelfHeroAllowed && shelfHeroBackground && shelf.id === firstVisibleId} heroLabelMount={perShelfHeroAllowed && (forceCssLoaderThemes || (hideRecentsSetting && shelf.id === firstVisibleId))} forceExpanded={hideRecentsSetting && shelf.id === firstVisibleId} forceLayoutAsRecents={forceCssLoaderThemes && !(hideRecentsSetting && shelf.id === firstVisibleId)} />;
      })}
      <BadgeFocusOverlay />
      <FriendsAvatarOverlay />
    </RootContainer>
  );
}

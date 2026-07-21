import React from "react";
import i18next from "i18next";
import { HomeShelves as HomeShelvesRaw } from "../components/HomeInject";
import { wrapHomeShelves } from "../qa/harness";
const HomeShelves = wrapHomeShelves(HomeShelvesRaw);
import { SearchOverlay } from "../features/search/SearchOverlay";
import { ShelfSideNav } from "../features/sidenav/ShelfSideNav";
try { (globalThis as any).__ds_homepatch_loaded = Date.now(); (globalThis as any).__ds_overlays_imported = typeof SearchOverlay === 'function' && typeof ShelfSideNav === 'function'; } catch {}
import { logDiagnostic } from "./diagnostics";
import { logError, logInfo, logWarn } from "./logger";
import { setPreferredSteamWindow } from "./steamHost";
import { notify } from "../components/notify";
import { afterPatch } from "./host/decky";
import { restoreFocusNavigationWithin, suppressFocusNavigationWithin } from "./homeTabNavigation";

const ROOT_ID = "deck-shelves-home-root";
const GLOBAL_COMPONENT_ID = "DeckShelvesHomeDomBridge";
const HOME_NATIVE_SLOT_KEY = "deck-shelves-native-home-slot";

const patchedHomeTypes = new WeakSet<object>();

function hasRecentsSignature(node: any, depth = 0): boolean {
  if (!node || depth > 7) return false;
  if (Array.isArray(node)) return node.some((child) => hasRecentsSignature(child, depth + 1));
  if (typeof node !== "object") return false;
  const props = node.props;
  if (props && Object.prototype.hasOwnProperty.call(props, "autoFocus")
    && Object.prototype.hasOwnProperty.call(props, "showBackground")) return true;
  return hasRecentsSignature(props?.children, depth + 1);
}

function findNativeHomeChildrenHolder(node: any, depth = 0): { holder: any; recentsIndex: number } | null {
  if (!node || depth > 10 || typeof node !== "object") return null;
  const children = node.props?.children;
  const branches = Array.isArray(children) ? children : (children == null ? [] : [children]);

  /* Prefer the deepest matching holder. The Home render contains a Fragment
     whose direct branches are Recent Games, Home Tabs, and the trailing home
     section. Inserting into that array makes Deck Shelves a real React child
     of Steam's scrollable Home panel instead of a later DOM sibling. */
  for (const child of branches) {
    const nested = findNativeHomeChildrenHolder(child, depth + 1);
    if (nested) return nested;
  }
  if (!Array.isArray(children) || children.length < 2) return null;
  const recentsIndex = children.findIndex((child: any) => hasRecentsSignature(child));
  if (recentsIndex < 0 || recentsIndex >= children.length - 1) return null;
  return { holder: node, recentsIndex };
}

function injectNativeHomeShelves(tree: any): boolean {
  const found = findNativeHomeChildrenHolder(tree);
  if (!found) return false;
  const children: any[] = found.holder.props.children;
  if (children.some((child: any) => child?.key === HOME_NATIVE_SLOT_KEY)) return true;
  const slot = React.createElement(HomeShelves as any, { key: HOME_NATIVE_SLOT_KEY });
  found.holder.props.children = [
    ...children.slice(0, found.recentsIndex + 1),
    slot,
    ...children.slice(found.recentsIndex + 1),
  ];
  try { (globalThis as any).__ds_native_home_injected = { at: Date.now(), index: found.recentsIndex + 1 }; } catch {}
  return true;
}

function installNativeHomeMount(routerHook: any): { uninstall(): void } | null {
  if (typeof routerHook?.addPatch !== "function") return null;
  const patchFn = (props: { children: any }) => {
    try {
      const outer = props?.children;
      if (!outer?.type || patchedHomeTypes.has(outer.type)) return props;
      patchedHomeTypes.add(outer.type);
      afterPatch(outer, "type", (_a: any, first?: any) => {
        if (!first?.type || patchedHomeTypes.has(first.type)) return first;
        patchedHomeTypes.add(first.type);
        afterPatch(first.type, "type", (_b: any, homeTree?: any) => {
          if (homeTree && !injectNativeHomeShelves(homeTree)) {
            try { (globalThis as any).__ds_native_home_injection_miss = Date.now(); } catch {}
          }
          return homeTree;
        });
        return first;
      });
    } catch (e) { logWarn("HOME", "native Home mount patch failed", String(e)); }
    return props;
  };
  try {
    const patch = routerHook.addPatch("/library/home", patchFn);
    logInfo("HOME", "native Home React mount registered");
    return { uninstall: () => { try { routerHook.removePatch?.("/library/home", patch); } catch {} } };
  } catch (e) {
    logWarn("HOME", "native Home React mount unavailable", String(e));
    return null;
  }
}

let removeGlobalComponent: (() => void) | null = null;
const uninstallHooks: Array<() => void> = [];
let lastHostSource = "";
let bridgeHostWindow: Window | null = null;

/**
 * Millennium evaluates plugins in SharedJSContext, but its global components
 * are committed into the Steam UI window.  A DOM ref is the reliable bridge
 * between those contexts: ownerDocument is the document React actually
 * rendered into, rather than the document that evaluated this module.
 */
function captureBridgeHost(node: HTMLElement | null): void {
  if (!node?.ownerDocument) return;
  const win = node.ownerDocument.defaultView;
  if (!win || win === bridgeHostWindow) return;
  bridgeHostWindow = win;
  setPreferredSteamWindow(win);
  logInfo("HOME", "captured rendered Steam host", {
    title: node.ownerDocument.title,
    href: `${win.location?.pathname ?? ""}${win.location?.hash ?? ""}`,
  });
}

// --- Crash protection ---
let mountFailed = false;
let mountError: string | null = null;
const MAX_BOUNDARY_FAILURES = 3;
let boundaryFailureCount = 0;

if (__DEV__ && typeof __QA_SHELF_ERROR__ !== "undefined" && __QA_SHELF_ERROR__) {
  mountFailed = true;
  mountError = "QA: forced shelf render error";
}

export function getMountFailed(): boolean { return mountFailed; }
export function getMountError(): string | null { return mountError; }
export function resetMountFailed(): void { mountFailed = false; mountError = null; boundaryFailureCount = 0; notifyMountFailedChange(); }

const mountFailedListeners = new Set<() => void>();
export function subscribeMountFailed(cb: () => void): () => void {
  mountFailedListeners.add(cb);
  return () => { mountFailedListeners.delete(cb); };
}
function notifyMountFailedChange(): void {
  for (const cb of mountFailedListeners) { try { cb(); } catch {} }
}

// --- Recents hiding ---
let cachedRecentsEl: HTMLElement | null = null;
let pendingHideRecents: boolean = false;
let pendingHideHomeTabs: boolean = false;

/** Override the DS mount margin-top while the replace-recents toggle is
 *  injecting. The default CSS pulls the DS area up 32px to overlap the recents
 *  bottom (fine when recents is collapsed); with replace active the recents row
 *  stays visible, so that overlap would push the next DS shelf's title into it
 *  (esp. under CSS Loader themes like SLH that extend recents visually). */
export function applyReplaceActiveMargin(active: boolean): void {
  try {
    const { doc } = getHostContext();
    const mount = doc.getElementById(ROOT_ID) as HTMLElement | null;
    if (!mount) return;
    if (active) {
      mount.style.setProperty("margin-top", "0px", "important");
    } else {
      // Leave applyHideRecents in control when replace is not active.
      mount.style.removeProperty("margin-top");
    }
  } catch (e) { logInfo("HOME", "applyReplaceActiveMargin failed", String(e)); }
}

const RECENTS_LABEL_FRAGMENTS = ["jogos recentes", "recent games", "recently played", "played recently", "jogados recentemente"];

function reseedCachedRecentsEl(): void {
  if (cachedRecentsEl && cachedRecentsEl.isConnected) return;
  try {
    const { doc } = getHostContext();
    const mount = doc.getElementById(ROOT_ID) as HTMLElement | null;
    if (mount) cachedRecentsEl = findRecentsEl(doc as Document, mount);
  } catch (e) { logInfo("HOME", "applyHideRecents: findRecentsEl failed", String(e)); }
}

function elMatchesRecentsLabel(el: HTMLElement): boolean {
  try {
    const aria = (el.getAttribute && el.getAttribute('aria-label'))?.toLowerCase() ?? '';
    const txt = (aria || (el.innerText || '')).toLowerCase().substring(0, 80);
    return RECENTS_LABEL_FRAGMENTS.some((l) => txt.includes(l));
  } catch { return false; }
}

function restoreRecentsByLabelSearch(): void {
  try {
    const { doc } = getHostContext();
    for (const el of Array.from(doc.querySelectorAll<HTMLElement>('*'))) {
      if (!elMatchesRecentsLabel(el)) continue;
      try { el.style.visibility = ''; el.style.height = ''; el.style.overflow = ''; } catch {}
    }
  } catch (e) { logInfo("HOME", "applyHideRecents: fallback restore failed", String(e)); }
}

function applyRecentsCollapse(hidden: boolean): void {
  if (!cachedRecentsEl) return;
  try {
    cachedRecentsEl.style.visibility = hidden ? "hidden" : "";
    cachedRecentsEl.style.height     = hidden ? "0px" : "";
    cachedRecentsEl.style.overflow   = hidden ? "hidden" : "";
  } catch (e) { logInfo("HOME", "applyHideRecents: style set failed", String(e)); }
}

function applyMountTopMargin(hidden: boolean): void {
  try {
    const { doc } = getHostContext();
    const mount = doc.getElementById(ROOT_ID) as HTMLElement | null;
    if (!mount) return;
    mount.style.setProperty("margin-top", hidden ? "56px" : "", "important");
    if (!hidden) { try { mount.style.removeProperty('margin-top'); } catch {} }
  } catch (e) { logInfo("HOME", "applyHideRecents: margin-top failed", String(e)); }
}

export function applyHideRecents(hidden: boolean): void {
  pendingHideRecents = hidden;
  reseedCachedRecentsEl();
  if (!cachedRecentsEl && !hidden) restoreRecentsByLabelSearch();
  applyRecentsCollapse(hidden);
  applyMountTopMargin(hidden);
}

// --- Home tabs (the native home area: recents + friends + novidades, etc.) ---
/* Scope: hide every sibling of our mount inside the same parent. Steam's home
   viewport places all native "tabs" as siblings of our mount; removing all of
   them leaves our shelves as the only visible area, which is the contract.
   Each candidate must carry at least one webpack-hashed token so decorative
   spacers/stray nodes aren't touched — no hardcoded classes. */
function hideSiblingDisplay(el: HTMLElement): void {
  if (el.dataset.dsHtHidden !== "1") {
    el.dataset.dsHtPrevDisplay = el.style.getPropertyValue("display") || "";
    el.dataset.dsHtHidden = "1";
  }
  el.style.setProperty("display", "none", "important");
  el.setAttribute("aria-hidden", "true");
}

function restoreSiblingDisplay(el: HTMLElement): void {
  if (el.dataset.dsHtHidden !== "1") return;
  const prev = el.dataset.dsHtPrevDisplay ?? "";
  el.style.removeProperty("display");
  if (prev) el.style.setProperty("display", prev);
  delete el.dataset.dsHtHidden;
  delete el.dataset.dsHtPrevDisplay;
  el.removeAttribute("aria-hidden");
}

function setSiblingHidden(el: HTMLElement, hidden: boolean) {
  if (hidden) {
    hideSiblingDisplay(el);
    suppressFocusNavigationWithin(el);
  } else {
    restoreFocusNavigationWithin(el);
    restoreSiblingDisplay(el);
  }
}

const hiddenHomeTabs = new Set<HTMLElement>();
const homeTabObservers = new Map<HTMLElement, MutationObserver>();

function observeHiddenHomeTabs(el: HTMLElement): void {
  if (homeTabObservers.has(el)) return;
  const Observer = el.ownerDocument.defaultView?.MutationObserver;
  if (!Observer) return;
  const observer = new Observer(() => suppressFocusNavigationWithin(el));
  observer.observe(el, { childList: true, subtree: true });
  homeTabObservers.set(el, observer);
}

function stopObservingHiddenHomeTabs(el: HTMLElement): void {
  homeTabObservers.get(el)?.disconnect();
  homeTabObservers.delete(el);
}

/* Identify the "home tabs" siblings (Novidades/Amigos/Recomendados). These are
   distinguished by containing a [role=tablist] descendant — a semantic marker
   that survives Steam bundle renames and doesn't overlap with recents (which
   has no tablist). */
function collectHomeTabSiblings(mountEl: HTMLElement): HTMLElement[] {
  const parent = mountEl.parentElement;
  if (!parent) return [];
  const out: HTMLElement[] = [];
  for (const child of Array.from(parent.children) as HTMLElement[]) {
    if (child === mountEl) continue;
    if (child.querySelector('[role="tablist"]')) out.push(child);
  }
  return out;
}

function restoreAllHomeTabs(): void {
  for (const el of Array.from(hiddenHomeTabs)) {
    stopObservingHiddenHomeTabs(el);
    setSiblingHidden(el, false);
  }
  hiddenHomeTabs.clear();
}

function syncHomeTabsHidden(current: HTMLElement[]): void {
  const currentSet = new Set(current);
  for (const el of Array.from(hiddenHomeTabs)) {
    if (!el.isConnected) {
      stopObservingHiddenHomeTabs(el);
      restoreFocusNavigationWithin(el);
      hiddenHomeTabs.delete(el);
      continue;
    }
    if (!currentSet.has(el)) {
      stopObservingHiddenHomeTabs(el);
      setSiblingHidden(el, false);
      hiddenHomeTabs.delete(el);
    }
  }
  for (const el of current) {
    if (!hiddenHomeTabs.has(el)) {
      setSiblingHidden(el, true);
      hiddenHomeTabs.add(el);
    }
    suppressFocusNavigationWithin(el);
    observeHiddenHomeTabs(el);
  }
}

export function applyHideHomeTabs(hidden: boolean): void {
  pendingHideHomeTabs = hidden;
  try {
    if (!hidden) { restoreAllHomeTabs(); return; }
    const { doc } = getHostContext();
    const mount = doc.getElementById(ROOT_ID) as HTMLElement | null;
    if (!mount) return;
    syncHomeTabsHidden(collectHomeTabSiblings(mount));
  } catch (e) { logInfo("HOME", "applyHideHomeTabs failed", String(e)); }
}

export function reapplyHomeHides(): void {
  applyHideRecents(pendingHideRecents);
  applyHideHomeTabs(pendingHideHomeTabs);
}

function isDsOwn(el: HTMLElement | null, mountEl: HTMLElement): boolean {
  if (!el) return false;
  if (el === mountEl || el.id === ROOT_ID) return true;
  if (el.classList?.contains('ds-shelf')) return true;
  if (el.classList?.contains('deck-shelves-root')) return true;
  return !!el.querySelector?.('.ds-shelf, .deck-shelves-root, #' + ROOT_ID);
}

function ariaOrInnerTextMatches(el: HTMLElement, labels: string[]): boolean {
  const txt = (el.getAttribute?.("aria-label") || el.innerText || "").toLowerCase().substring(0, 80);
  return labels.some((l) => txt.includes(l));
}

function previousSiblingIsRecents(prev: HTMLElement | null, mountEl: HTMLElement, labels: string[]): HTMLElement | null {
  if (!prev || isDsOwn(prev, mountEl)) return null;
  if (ariaOrInnerTextMatches(prev, labels)) return prev;
  const inner = prev.querySelector("[aria-label]");
  if (inner) {
    const innerTxt = (inner.getAttribute("aria-label") || "").toLowerCase();
    if (labels.some((l) => innerTxt.includes(l))) return prev;
  }
  return prev.querySelector("[class*='ReactVirtualized']") ? prev : null;
}

function recentsFromAriaScan(doc: Document, mountEl: HTMLElement, mountParent: HTMLElement, labels: string[]): HTMLElement | null {
  for (const node of Array.from(doc.querySelectorAll("[aria-label]"))) {
    const txt = (node.getAttribute("aria-label") || "").toLowerCase();
    if (!labels.some((l) => txt.includes(l))) continue;
    let el = node as HTMLElement;
    while (el.parentElement && el.parentElement !== mountParent) el = el.parentElement;
    if (el.parentElement === mountParent && el !== mountEl && !isDsOwn(el, mountEl)) return el;
  }
  return null;
}

function findRecentsEl(doc: Document, mountEl: HTMLElement): HTMLElement | null {
  const labels = RECENTS_LABEL_FRAGMENTS;
  const mountParent = mountEl.parentElement;
  if (!mountParent) return null;
  const prev = previousSiblingIsRecents(mountEl.previousElementSibling as HTMLElement | null, mountEl, labels);
  return prev ?? recentsFromAriaScan(doc, mountEl, mountParent, labels);
}

function getWindowCandidates(): Array<{ win: Window; source: string }> {
  const out: Array<{ win: Window; source: string }> = [];
  const seen = new Set<Window>();
  const push = (candidate: any, source: string) => {
    if (!candidate || typeof candidate !== "object") return;
    const win = candidate as Window;
    if (!win.document || seen.has(win)) return;
    seen.add(win);
    out.push({ win, source });
  };
  const sources: Array<[() => any, string]> = [
    [() => bridgeHostWindow, "renderedBridge"],
    [() => window, "current"],
    [() => (window as any).opener, "opener"],
    [() => (window as any).SteamUIStore?.GetFocusedWindowInstance?.()?.BrowserWindow, "focusedWindow"],
    [() => (window as any).SteamUIStore?.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow, "mainWindow"],
  ];
  for (const [getter, source] of sources) { try { push(getter(), source); } catch {} }
  try {
    const steamWindows = (window as any).SteamUIStore?.WindowStore?.SteamUIWindows;
    if (Array.isArray(steamWindows)) {
      for (const entry of steamWindows) push(entry?.BrowserWindow, "steamUIWindow");
    }
  } catch {}
  return out;
}

const RECENTS_QS = '[aria-label="Jogos recentes"], [aria-label="Recent Games"], [class*="ReactVirtualized__Grid"][aria-label]';
const LIBRARY_HOME_QS = '[class*="libraryhome"], [class*="LibraryHome"], [class*="BasicHomeView"], [class*="gamepadlibrary"]';

function safeMatch(doc: Document, selector: string): boolean {
  try { return !!doc.querySelector(selector); } catch { return false; }
}

function windowHref(win: Window): string {
  return `${win.location?.pathname ?? ""}${win.location?.hash ?? ""}`.toLowerCase();
}

function hrefIsLibraryHome(href: string): boolean {
  return href.includes("/routes/library/home") || href.includes("library/home");
}

function scoreDocSignals(doc: Document): number {
  let s = 0;
  if (safeMatch(doc, RECENTS_QS)) s += 8;
  if (safeMatch(doc, LIBRARY_HOME_QS)) s += 6;
  if (doc.body?.childElementCount) s += 1;
  return s;
}

function scoreWindow(win: Window): number {
  try {
    const doc = win.document;
    return (hrefIsLibraryHome(windowHref(win)) ? 4 : 0) + scoreDocSignals(doc);
  } catch { return -1; }
}

function logHostSourceChange(source: string, win: Window, score: number): void {
  if (source === lastHostSource) return;
  lastHostSource = source;
  logInfo("HOME", "host context selected", {
    source,
    href: `${win.location?.pathname ?? ""}${win.location?.hash ?? ""}`,
    score,
  });
}

function getHostContext() {
  const best = getWindowCandidates()
    .map((entry) => ({ ...entry, score: scoreWindow(entry.win) }))
    .sort((a, b) => b.score - a.score)[0];
  const win = best?.win ?? window;
  const doc = win.document ?? document;
  const source = best?.source ?? "current";
  setPreferredSteamWindow(win);
  logHostSourceChange(source, win, best?.score ?? 0);
  return { win, doc, source };
}

class HomeBoundary extends React.Component<{ children: React.ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError(_err: unknown) { return { crashed: true }; }
  componentDidCatch(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    boundaryFailureCount++;
    if (__DEV__) logError("HOME", `shelf render crashed (${boundaryFailureCount}/${MAX_BOUNDARY_FAILURES})`, msg);
    logDiagnostic("error", "Home shelf render crashed", msg);
    if (boundaryFailureCount >= MAX_BOUNDARY_FAILURES) {
      mountFailed = true;
      mountError = msg;
      try {
        const { doc } = getHostContext();
        const mount = doc.getElementById(ROOT_ID) as HTMLElement | null;
        if (mount) { mount.innerHTML = ""; mount.style.display = "none"; }
      } catch {}
      notify("error", { title: i18next.t("mount_crash_title"), body: i18next.t("mount_crash_warning") });
      notifyMountFailedChange();
    } else {
      setTimeout(() => { if (!mountFailed) this.setState({ crashed: false }); }, 500);
    }
  }
  render() { return this.state.crashed ? null : this.props.children; }
}

function HomeDomBridge() {
  try { (globalThis as any).__ds_bridge_renders = (((globalThis as any).__ds_bridge_renders ?? 0) + 1); } catch {}
  getHostContext();
  return React.createElement(
    HomeBoundary,
    null,
    React.createElement(React.Fragment, null,
      React.createElement("span", {
        ref: captureBridgeHost,
        "data-deck-shelves-host-bridge": "1",
        style: { display: "none" },
      }),
      React.createElement(SearchOverlay),
      React.createElement(ShelfSideNav),
    ),
  );
}

function tryStoreMethod(store: any, method: 'addComponent' | 'register'): boolean {
  if (typeof store[method] !== "function") return false;
  try {
    const dispose = store[method](GLOBAL_COMPONENT_ID, HomeDomBridge);
    if (typeof dispose === "function") uninstallHooks.push(dispose);
    return true;
  } catch { return false; }
}

function tryStoreStateArray(store: any, state: any, key: 'components' | 'globalComponents'): boolean {
  const arr = (state as any)[key];
  if (!Array.isArray(arr)) return false;
  const next = arr.slice();
  next.push({ id: GLOBAL_COMPONENT_ID, component: HomeDomBridge });
  store.setState({ ...(state as any), [key]: next });
  uninstallHooks.push(() => {
    try {
      const s = store.getState?.();
      const filtered = Array.isArray(s?.[key]) ? s[key].filter((x: any) => x?.id !== GLOBAL_COMPONENT_ID) : s?.[key];
      store.setState({ ...(s ?? {}), [key]: filtered });
    } catch {}
  });
  return true;
}

function tryStoreGetSetState(store: any): boolean {
  if (typeof store.getState !== "function" || typeof store.setState !== "function") return false;
  try {
    const state = store.getState?.();
    if (!state || typeof state !== "object") return false;
    return tryStoreStateArray(store, state, 'components') || tryStoreStateArray(store, state, 'globalComponents');
  } catch { return false; }
}

function registerBridgeViaStore(store: any): boolean {
  if (!store) return false;
  return tryStoreMethod(store, 'addComponent')
      || tryStoreMethod(store, 'register')
      || tryStoreGetSetState(store);
}

function registerBridgeViaWrapper(routerHook: any): boolean {
  const wrapKey = ["DeckyGlobalComponentsWrapper", "DeckyGamepadRouterWrapper", "DeckyDesktopRouterWrapper"];
  for (const key of wrapKey) {
    const original = routerHook?.[key];
    if (typeof original !== "function") continue;
    if ((original as any).__deckShelvesWrapped) return true;
    try {
      const wrapped = function wrappedDeckyComponent(props: any) {
        const originalNode = original(props);
        return React.createElement(React.Fragment, null, originalNode, React.createElement(HomeDomBridge));
      };
      (wrapped as any).__deckShelvesWrapped = true;
      routerHook[key] = wrapped;
      uninstallHooks.push(() => {
        try {
          if (routerHook[key] === wrapped) routerHook[key] = original;
        } catch {}
      });
      return true;
    } catch {}
  }
  return false;
}

function registerBridgeViaRouteHook(routerHook: any): boolean {
  const originalRoute = routerHook?.Route;
  if (typeof originalRoute !== "function") return false;
  if ((originalRoute as any).__deckShelvesWrappedRoute) return true;
  try {
    const wrappedRoute = function wrappedRoute(...args: any[]) {
      const node = originalRoute(...args);
      return React.createElement(React.Fragment, null, node, React.createElement(HomeDomBridge));
    };
    (wrappedRoute as any).__deckShelvesWrappedRoute = true;
    routerHook.Route = wrappedRoute;
    uninstallHooks.push(() => {
      try {
        if (routerHook.Route === wrappedRoute) routerHook.Route = originalRoute;
      } catch {}
    });
    return true;
  } catch {}
  return false;
}

type BridgeAttempt = { signature: string; invoke: () => any };

function buildAddGlobalAttempts(addGlobalComponent: Function): BridgeAttempt[] {
  return [
    { signature: "id,component", invoke: () => addGlobalComponent(GLOBAL_COMPONENT_ID, HomeDomBridge) },
    { signature: "component", invoke: () => addGlobalComponent(HomeDomBridge) },
    { signature: "object", invoke: () => addGlobalComponent({ id: GLOBAL_COMPONENT_ID, component: HomeDomBridge }) },
  ];
}

function tryAddGlobalComponentSignatures(routerHook: any): boolean {
  const fn = routerHook?.addGlobalComponent;
  if (typeof fn !== "function") {
    logWarn("HOME", "routerHook.addGlobalComponent unavailable");
    return false;
  }
  for (const attempt of buildAddGlobalAttempts(fn)) {
    try {
      const disp = attempt.invoke();
      if (typeof disp === "function") removeGlobalComponent = disp;
      logInfo("HOME", "global component bridge registered", { signature: attempt.signature });
      return true;
    } catch {}
  }
  return false;
}

function registerGlobalBridge(routerHook: any): boolean {
  if (tryAddGlobalComponentSignatures(routerHook)) return true;
  const storeAttempts: Array<[any, string]> = [
    [routerHook?.globalComponentsState, "globalComponentsState"],
    [routerHook?.renderedComponents, "renderedComponents"],
  ];
  for (const [store, signature] of storeAttempts) {
    if (registerBridgeViaStore(store)) {
      logInfo("HOME", "global component bridge registered", { signature });
      return true;
    }
  }
  if (registerBridgeViaWrapper(routerHook)) {
    logInfo("HOME", "global component bridge registered", { signature: "wrapper-patch" });
    return true;
  }
  if (registerBridgeViaRouteHook(routerHook)) {
    logInfo("HOME", "global component bridge registered", { signature: "route-hook" });
    return true;
  }
  return false;
}

export function installHomePatch(_routerHook?: any) {
  if (typeof document === "undefined") return null;
  const routerHook = _routerHook;

  logInfo("HOME", "installHomePatch start", {
    pathname: getHostContext().win.location?.pathname,
    hash: getHostContext().win.location?.hash,
    hasRouterHook: !!routerHook,
    routerHookKeys: Object.keys(routerHook ?? {}).slice(0, 20),
  });

  let bridgeRegistered = false;
  const nativeHomeMount = installNativeHomeMount(routerHook);

  try {
    bridgeRegistered = registerGlobalBridge(routerHook);
    if (!bridgeRegistered) logWarn("HOME", "all global bridge strategies failed");
  } catch (error) {
    logWarn("HOME", "global component bridge setup failed", String(error));
  }



  logInfo("HOME", "installHomePatch complete", { bridgeRegistered });

  const cleanup = () => {
    try { nativeHomeMount?.uninstall(); } catch {}
    try { removeGlobalComponent?.(); removeGlobalComponent = null; } catch {}
    try { routerHook?.removeGlobalComponent?.(GLOBAL_COMPONENT_ID); } catch {}
    while (uninstallHooks.length) {
      try { uninstallHooks.pop()?.(); } catch {}
    }
  };

  return {
    uninstall() {
      logInfo("HOME", "uninstalling home patch");
      cleanup();
    },
  };
}

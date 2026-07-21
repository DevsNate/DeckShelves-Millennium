import { Navigation } from "./host/decky";
import { getAppMeta, getAppMetaBatch, getAppName, listCollections, listLibraryTabs, resolveShelfAppIds } from "../steam";
import type { ShelfSource } from "../types";
import type { PlatformApi } from "./platform";
import { logError } from "./logger";

let lastAppNavigation = { appid: 0, at: 0 };

function navigate(appid: number) {
  const now = Date.now();
  // A single controller activation can arrive through onActivate,
  // onOKButton and vgp_onok. The card-local guard is lost if navigation
  // remounts the home tree between callbacks, so keep the final route push
  // guarded at module scope as well.
  if (lastAppNavigation.appid === appid && now - lastAppNavigation.at < 1000) return;
  lastAppNavigation = { appid, at: now };
  try {
    const nav = resolveNav();
    if (typeof nav?.Navigate === "function") nav.Navigate(`/library/app/${appid}`);
    else if (typeof nav?.NavigateTo === "function") nav.NavigateTo(`/library/app/${appid}`);
    else Navigation.Navigate(`/library/app/${appid}`);
  } catch (error) {
    logError("RUNTIME", "navigateToApp failed", String(error));
  }
}

// Resolve Steam's Navigation object (BP global first, imported fallback).
function resolveNav(): any {
  const steamClient = (globalThis as any).SteamClient ?? (globalThis as any).window?.SteamClient;
  return steamClient?.Navigation ?? Navigation;
}

function navigateToShelfSource(source: ShelfSource, _title?: string) {
  // Original navigation behavior — proven over many releases:
  //   - collection → /library/collection/<id> (specific collection page)
  //   - tab        → /library  (Steam BP opens the library on the user's
  /*                  last-active library tab; nothing extra to do here)
       - filter     → /library
       - default    → /library
     Bare /library is the canonical "open the library" route. Steam's BP
     resolves it to whichever library view the user was last on. */
  const nav = resolveNav();
  const safeNavigate = (path: string) => {
    try { nav?.Navigate?.(path); return true; } catch {}
    try { nav?.NavigateTo?.(path); return true; } catch {}
    return false;
  };
  const tryClickCollectionLink = (id: string) => {
    try {
      const doc = (globalThis as any).document ?? (globalThis as any).window?.document;
      if (!doc) return false;
      const selectors = [
        `[data-collection-id="${id}"]`,
        `[data-collection-id*="${id}"]`,
        `a[href*="${encodeURIComponent(id)}"]`,
        `a[href*="${id}"]`,
      ];
      for (const s of selectors) {
        const el = doc.querySelector(s) as HTMLElement | null;
        if (el) { el.click(); return true; }
      }
    } catch {}
    return false;
  };
  const navCollection = () => {
    const id = String((source as any).collectionId ?? "");
    if (id) {
      const candidates = [
        `/library/collection/${id}`,
        `/library/collections/${id}`,
        `/library/collections#${id}`,
        `/library/collections/${encodeURIComponent(id)}`,
      ];
      for (const p of candidates) if (safeNavigate(p)) return;
      if (tryClickCollectionLink(id)) return;
    }
    if (safeNavigate('/library/collections')) return;
    safeNavigate('/library/home');
  };
  if (source.type === 'tab') {
    if (safeNavigate('/library')) return;
    safeNavigate('/library/home');
    return;
  }
  if (source.type === 'collection') {
    navCollection();
    return;
  }
  if (source.type === 'filter') {
    if (safeNavigate('/library')) return;
    safeNavigate('/library/home');
    return;
  }
  safeNavigate('/library');
}

export function createDeckyPlatform(): PlatformApi {
  return {
    listCollections,
    listLibraryTabs,
    resolveShelfAppIds,
    getAppName,
    getAppMeta,
    getAppMetaBatch,
    navigateToApp: navigate,
    navigateToShelfSource,
  };
}

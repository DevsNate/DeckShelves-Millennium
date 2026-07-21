let cachedVersion: string | null | undefined;
let prefetchPromise: Promise<string | null> | null = null;

function versionFromSteamClient(): string | null {
  try {
    const sc: any = (globalThis as any).SteamClient;
    const os = sc?.System?.GetOSVersion?.();
    if (typeof os === "string" && os.length) return os;
    if (typeof os === "number" && Number.isFinite(os)) return String(os);
  } catch {}
  return null;
}

function versionFromDeckySettings(): string | null {
  try {
    const ds: any = (globalThis as any).SteamUIStore?.DeckySettings;
    const v = ds?.steamos_version ?? ds?.osVersion;
    if (typeof v === "string" && v.length) return v;
  } catch {}
  return null;
}

function versionFromUserAgent(): string | null {
  try {
    const ua = (globalThis as any).navigator?.userAgent as string | undefined;
    const m = ua?.match(/SteamOS\/(\d+\.\d+(?:\.\d+)?)/);
    if (m?.[1]) return m[1];
  } catch {}
  return null;
}

// Sync SteamOS-version sources in priority order (first hit wins).
function readRawVersionSync(): string | null {
  return versionFromSteamClient() ?? versionFromDeckySettings() ?? versionFromUserAgent();
}

async function readRawVersionAsync(): Promise<string | null> {
  // Sync sources first — cheaper.
  const sync = readRawVersionSync();
  if (sync) return sync;
  // Last resort: GetSystemInfo. Only source available on SteamOS 3.7.x;
  // also exists on 3.8/3.9 but the sync sources resolve first there.
  try {
    const sc: any = (globalThis as any).SteamClient;
    const info = await sc?.System?.GetSystemInfo?.();
    const v = info?.sOSVersionId;
    if (typeof v === "string" && v.length) return v;
  } catch {}
  return null;
}

export async function prefetchSteamOSVersion(): Promise<string | null> {
  if (cachedVersion !== undefined) return cachedVersion ?? null;
  if (prefetchPromise) return prefetchPromise;
  prefetchPromise = readRawVersionAsync().then((v) => {
    cachedVersion = v;
    return v;
  });
  return prefetchPromise;
}

export function getSteamOSVersion(): string | null {
  if (cachedVersion !== undefined) return cachedVersion ?? null;
  const sync = readRawVersionSync();
  if (sync) {
    cachedVersion = sync;
    return cachedVersion;
  }
  // Kick off async prefetch so subsequent calls hit the cache.
  void prefetchSteamOSVersion();
  return null;
}

export function isSteamOS39OrLater(): boolean | null {
  const v = getSteamOSVersion();
  if (!v) return null;
  const m = v.match(/^(\d+)\.(\d+)/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return major > 3 || (major === 3 && minor >= 9);
}

export function isSteamOS38OrLater(): boolean | null {
  const v = getSteamOSVersion();
  if (!v) return null;
  const m = v.match(/^(\d+)\.(\d+)/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return major > 3 || (major === 3 && minor >= 8);
}

export type SteamFlowDirection = "horizontal" | "vertical" | "column" | "row";

export function isMillenniumNavigationRuntime(): boolean {
  try { return (globalThis as any).__DECK_SHELVES_MILLENNIUM__ === true; }
  catch { return false; }
}

/**
 * Deck Shelves 3.0.2 deliberately left this prop unset for its Decky build.
 * Millennium needs the current Steam contract explicitly: the July 2026
 * GamepadNavigation parser accepts `row` / `column`, not Decky's historical
 * `horizontal` / `vertical` aliases.
 */
export function flowChildrenProps(direction: SteamFlowDirection): Record<string, string> {
  if (!isMillenniumNavigationRuntime()) return {};
  const flow = direction === "horizontal" || direction === "row" ? "row" : "column";
  return { "flow-children": flow };
}

const NAV_KEY_PREFIX = "deck-shelves";

function stableNavPart(value: string | number | null | undefined, fallback: string): string {
  const part = String(value ?? "").trim();
  return part || fallback;
}

/** Native section properties used only by the Millennium renderer. */
export function millenniumShelfSectionProps(shelfId?: string, title?: string): Record<string, unknown> {
  if (!isMillenniumNavigationRuntime()) return {};
  const id = stableNavPart(shelfId, stableNavPart(title, "shelf"));
  return {
    navKey: `${NAV_KEY_PREFIX}:shelf:${id}`,
    focusable: false,
    noFocusRing: true,
    // Steam's current NavEntryPreferPosition.MAINTAIN_X enum value. This is
    // how a vertical move enters the card nearest the previous x position.
    navEntryPreferPosition: 2,
    scrollIntoViewWhenChildFocused: true,
    ...flowChildrenProps("column"),
  };
}

/** Native horizontal row properties used only by the Millennium renderer. */
export function millenniumShelfRowProps(shelfId?: string, title?: string): Record<string, unknown> {
  if (!isMillenniumNavigationRuntime()) return {};
  const id = stableNavPart(shelfId, stableNavPart(title, "shelf"));
  return {
    navKey: `${NAV_KEY_PREFIX}:row:${id}`,
    focusable: false,
    noFocusRing: true,
    navEntryPreferPosition: 2,
    scrollIntoViewWhenChildFocused: true,
    ...flowChildrenProps("row"),
  };
}

/** Stable leaf/group key consumed by Steam's route focus-history serializer. */
export function millenniumCardNavKey(
  shelfId: string | undefined,
  itemId: string | number | undefined,
  fallbackIndex?: number,
): string | undefined {
  if (!isMillenniumNavigationRuntime()) return undefined;
  const shelf = stableNavPart(shelfId, "shelf");
  const item = stableNavPart(itemId, `index-${fallbackIndex ?? 0}`);
  return `${NAV_KEY_PREFIX}:card:${shelf}:${item}`;
}

import { buildSelectorFromToken, getRuntimeClassMap } from "../../core/webpackCompat";

function readForceThemes(): boolean {
  try {
    const raw = (globalThis as any).localStorage?.getItem?.('deck-shelves-settings-cache-v3');
    if (!raw) return false;
    return JSON.parse(raw)?.forceCssLoaderThemes === true;
  } catch { return false; }
}

const NATIVE_CARD_EXCLUDED = new Set(['Panel', 'Focusable', 'gpfocus', 'gpfocuswithin']);
// forceCssLoaderThemes adds DFL semantic card tokens (no state classes). Do NOT
// add `nativeCardWrapper` or `gpfocuswithin` — both turn theme focused-state
// selectors into all-card always-on rules.
const FORCE_THEME_TOKENS = [
  'nativeSemanticCard', 'nativeSemanticCardContainer', 'nativeSemanticCardImage',
  'nativeSemanticCardWrapper', 'nativeCapsule', 'nativeCapsuleImage',
  'nativeCapsuleArt', 'nativeCapsuleContainer', 'nativeCapsuleBg',
  'nativeLibraryItemBox', 'nativeGameCapsule',
];

function addSplitTokens(value: string | undefined, out: Set<string>): void {
  if (!value) return;
  for (const c of value.split(/\s+/)) if (c) out.add(c);
}

function collectSampleClasses(sample: HTMLElement, out: Set<string>): void {
  for (const cls of Array.from(sample.classList)) {
    if (NATIVE_CARD_EXCLUDED.has(cls) || cls.startsWith('ds-')) continue;
    out.add(cls);
  }
}

function nativeCardSamples(doc: Document, nativeCard: string): HTMLElement[] {
  const selector = buildSelectorFromToken(nativeCard);
  if (!selector) return [];
  try {
    return Array.from(doc.querySelectorAll<HTMLElement>(`${selector}:not(.ds-card)`));
  } catch {
    return [];
  }
}

/* Steam renders the featured landscape tile before the portrait cards. The
   old first-match lookup could therefore copy Landscape, FeaturedCapsule and
   ShowAsHovered onto every Deck Shelves portrait. Prefer a sample with the
   same aspect as the card being rendered, then prefer an idle sample so the
   adopted tokens describe structure instead of transient focus state. */
function pickNativeCardSample(doc: Document, nativeCard: string, featured: boolean): HTMLElement | null {
  const samples = nativeCardSamples(doc, nativeCard);
  if (!samples.length) return null;
  const scored = samples.map((el) => {
    try {
      const w = el.offsetWidth || el.getBoundingClientRect().width;
      const h = el.offsetHeight || el.getBoundingClientRect().height;
      const landscape = w > h * 1.35;
      const transformed = getComputedStyle(el).transform !== 'none';
      let score = landscape === featured ? 100 : 0;
      if (!transformed) score += 10;
      if (!el.matches(':focus') && !el.classList.contains('gpfocus')) score += 2;
      return { el, score };
    } catch {
      return { el, score: 0 };
    }
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.el ?? null;
}

function addForceThemeExtras(map: any, out: Set<string>): void {
  for (const k of FORCE_THEME_TOKENS) addSplitTokens(map[k], out);
}

// Returns null when the class map isn't ready yet (caller should retry).
// Returns a string (possibly empty) once the map is available.
export function resolveNativeCardClass(doc: Document | null, featured = false): string | null {
  const map = doc ? getRuntimeClassMap(doc) : null;
  if (!map?.nativeCard) return null;
  const nativeSample = doc ? pickNativeCardSample(doc, map.nativeCard, featured) : null;
  const out = new Set<string>();
  if (nativeSample) {
    collectSampleClasses(nativeSample, out);
  } else {
    if (map.nativeCard) out.add(map.nativeCard);
    addSplitTokens(map.nativeCardMods, out);
  }
  if (readForceThemes()) addForceThemeExtras(map, out);
  return Array.from(out).join(' ');
}

export function retryWithIntervals(fn: () => boolean, intervals: number[]): () => void {
  let attempts = 0;
  let timer: number | null = null;
  const tryRun = () => {
    attempts += 1;
    if (!fn() && attempts < intervals.length) {
      timer = window.setTimeout(tryRun, intervals[attempts - 1]);
    }
  };
  tryRun();
  return () => { if (timer) clearTimeout(timer); };
}


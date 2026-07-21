import { getAllSteamDocuments, getPreferredSteamWindow } from "../../runtime/steamHost";

export const ROOT_ID = "deck-shelves-home-root";

export function isHomeRoute(): boolean {
  const windows = new Set<Window>();
  try { windows.add(getPreferredSteamWindow()); } catch {}
  try {
    for (const document of getAllSteamDocuments()) {
      if (document.defaultView) windows.add(document.defaultView);
    }
  } catch {}
  for (const window of windows) {
    try {
      const route = `${window.location?.pathname ?? ""}${window.location?.hash ?? ""}`.toLowerCase();
      if (route.includes("/library/home")) return true;
    } catch {}
  }
  return false;
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = (seed | 0) >>> 0;
  for (let index = out.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [out[index], out[swapIndex]] = [out[swapIndex], out[index]];
  }
  return out;
}

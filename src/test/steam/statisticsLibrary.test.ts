import { describe, expect, it } from "vitest";
import { selectLibraryStatisticApps } from "../../steam/statisticsLibrary";
import type { AppOverview } from "../../steam";

const apps: AppOverview[] = [
  { appid: 1, display_name: "Owned game", app_type: 1 },
  { appid: 2, display_name: "Dedicated server", app_type: 4 },
  { appid: 3, display_name: "Demo", app_type: 8 },
  { appid: 4, display_name: "Shortcut", app_type: 1073741824, is_non_steam: true },
  { appid: 5, display_name: "Free game outside My games", app_type: 1 },
];

describe("Statistics library selection", () => {
  it("uses Steam's native My games ids instead of every app overview", () => {
    expect(selectLibraryStatisticApps(apps, new Set([1, 4])).map((app) => app.appid)).toEqual([1, 4]);
  });

  it("falls back to game and shortcut app types before collections are ready", () => {
    expect(selectLibraryStatisticApps(apps, new Set()).map((app) => app.appid)).toEqual([1, 4, 5]);
  });
});

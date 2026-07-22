import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../domain/defaults";
import { CURRENT_SETTINGS_SCHEMA_VERSION, migrateSettings } from "../../store/settingsStore";
import type { Settings } from "../../types";

describe("settings schema migrations", () => {
  it("stamps legacy unversioned settings with the current schema", () => {
    const legacy = { ...defaultSettings(), schemaVersion: undefined };
    const migrated = migrateSettings(legacy);
    expect(migrated.schemaVersion).toBe(CURRENT_SETTINGS_SCHEMA_VERSION);
  });

  it("is idempotent for current settings", () => {
    const current = defaultSettings();
    const once = migrateSettings(current);
    const twice = migrateSettings(once);
    expect(twice).toEqual(once);
  });

  it("does not downgrade a settings document from a newer schema", () => {
    const future = { ...defaultSettings(), schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION + 1 } as Settings;
    expect(migrateSettings(future)).toBe(future);
  });

  it("keeps the existing Recently Played source migration idempotent", () => {
    const legacy = {
      ...defaultSettings(),
      schemaVersion: undefined,
      shelves: [{
        id: "recent",
        title: "Recently Played",
        enabled: true,
        hidden: false,
        limit: 12,
        source: { type: "tab", tab: "recent" },
      }],
    } as Settings;
    const once = migrateSettings(legacy);
    const twice = migrateSettings(once);
    expect(once.shelves[0].source).toEqual({ type: "filter", filter: { sort: "recent" } });
    expect(twice).toEqual(once);
  });
});

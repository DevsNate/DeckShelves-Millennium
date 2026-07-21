import type { AppOverview } from "./index";

function isGameOrShortcut(app: AppOverview): boolean {
  if (app.is_non_steam === true || app.is_steam === false) return true;
  return app.app_type === undefined || app.app_type === 1;
}

/** Keep Statistics aligned with Steam's native My games collection. */
export function selectLibraryStatisticApps(
  apps: readonly AppOverview[],
  nativeLibraryIds: ReadonlySet<number>,
): AppOverview[] {
  if (nativeLibraryIds.size > 0) {
    return apps.filter((app) => nativeLibraryIds.has(app.appid));
  }
  return apps.filter(isGameOrShortcut);
}

import type { PublicSettingsSnapshot } from "@deck-shelves/api";
import type { Settings } from "../types";

export function projectSettingsSnapshot(s: Settings | null): PublicSettingsSnapshot {
  const x = (s ?? {}) as any;
  return {
    enabled: x.enabled === true,
    hideRecents: x.hideRecents === true,
    recentsReplaceSource: x.recentsReplaceSource === true,
    hideHomeTabs: x.hideHomeTabs === true,
    shelfHeroBackground: x.shelfHeroBackground === true,
    globalHeroEnabled: x.globalHeroEnabled === true,
    globalFullPageShelf: x.globalFullPageShelf === true,
    smartShelvesEnabled: x.smartShelvesEnabled === true,
    unifiedListEnabled: x.unifiedListEnabled === true,
    forceCssLoaderThemes: x.forceCssLoaderThemes === true,
    scaleMiniCarouselSpacing: x.scaleMiniCarouselSpacing === true,
    matchNativeShelfTitleOpacity: x.matchNativeShelfTitleOpacity === true,
    autoHideShelfTitles: x.autoHideShelfTitles === true,
    lightModeEnabled: x.lightModeEnabled === true,
    onlineFeaturesEnabled: x.onlineFeaturesEnabled === true,
    updateNotifyEnabled: x.updateNotifyEnabled !== false,
    integrationsEnabled: (x.integrationsEnabled ?? {}) as Record<string, boolean>,
    featureToggles: (x.featureToggles ?? {}) as Record<string, boolean>,
    activeProfileName: typeof x.activeProfileName === "string" ? x.activeProfileName : null,
  };
}

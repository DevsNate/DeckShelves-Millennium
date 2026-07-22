# Deck Shelves Millennium parity inventory

This inventory covers the user-facing configuration schema, callable backend
RPC surface, and public `window.deckShelves.api` extension surface from Deck
Shelves 3.1.0. Private implementation helpers are not separate compatibility
contracts. Status is tracked against the Millennium port.

## Explicitly excluded

- TabMaster discovery and tab-source compatibility (`get_tabmaster_tabs`,
  `hasTabMaster`, and the `tab` source's TabMaster-specific behavior)
- Native graphical file picker integration. Manual path entry and backend
  import/export/read/write operations remain in scope.

## Backend RPC functions

- Settings: `get_settings`, `set_settings`, `reset_settings`
- Backups: `list_backups`, `create_backup`, `restore_backup`, `export_backup`,
  `delete_backup`, `clear_backups`, `import_backup`
- Portable settings: `export_settings`, `import_settings`
- Files and paths: `get_user_home`, `get_user_desktop`, `write_json_file`,
  `get_user_pictures`, `read_json_file`, `read_image_b64`
- Host/context: `get_host_os`, `get_display_state`, `get_perf_snapshot`,
  `get_bluetooth_state`, `get_audio_state`, `get_css_loader_themes`
- Launcher sources: `list_available_launchers`, `list_launcher_games`
- Online source: `get_wishlist`
- Excluded: `get_tabmaster_tabs`

## Top-level settings

### Plugin, home, and layout

- `enabled`, `hideRecents`, `recentsReplaceSource`, `recentsReplaceShelfId`
- `hideHomeTabs`, `shelfHeroBackground`, `forceCssLoaderThemes`
- `globalMatchNativeSize`, `globalHighlightFirst`, `globalHighlightAll`,
  `globalHighlightRandom`
- `globalEnableLogo`, `globalEnableIcon`, `globalEnableDescription`,
  `globalDescriptionScale`, `globalDescriptionBelowLogo`, `globalLogoBelowShelf`
- `globalLogoPosition`, `globalDescriptionPosition`, `globalLogoSize`,
  `globalLogoTopOffset`, `globalFullPageShelf`
- `globalIconVerticalAlign`, `globalShelfTitlePosition`,
  `globalGameNamePosition`, `globalPlaytimePosition`, `globalDescriptionHeight`,
  `globalDescriptionLogoGap`
- `globalHideStatusLine`, `globalHideNewBadge`, `globalHideDiscountBadge`,
  `globalHideCompatIcons`, `globalHideNonSteamBadge`, `globalHideShelfTitle`,
  `globalHideGameNames`, `globalHideInstallIndicator`, `globalHideSeeMore`,
  `globalHideRefreshCard`
- `globalDedupeByName`, `globalHeroEnabled`, `globalGameInfoAbove`,
  `globalFriendsPlayingOverlay`, `globalFriendsPlayingOverlayRecent`
- Millennium additions retained across the update: `keepShelvesStacked`,
  `fadeRecentsTitle`

### Shelf collections and behavior

- `shelves`, `smartShelvesEnabled`, `smartShelvesAtBottom`, `smartShelves`
- `smartSurpriseMe`, `smartSurpriseMeCount`
- `savedFilters`, `savedSmartFilters`
- `unifiedListEnabled`, `allShelvesOrder`

### Search, navigation, QAM, and modes

- `settingsPageEnabled`, `contextSearchEnabled`, `contextSearchKeyboardEnabled`,
  `contextSearchOnEnter`, `sideNavEnabled`
- `qamHiddenToggles`, `qamHiddenSections`
- `lightModeEnabled`, `advancedModeEnabled`, `templateSuggestionsEnabled`,
  `removalSuggestionsEnabled`, `offlineModeEnabled`
- `buttonBindings`, `buttonBindingsDisabled`

### Online, profiles, integrations, and extensions

- `onlineFeaturesEnabled`, `onlineWishlistEnabled`, `onlinePriceSortEnabled`,
  `onlinePrivacyAccepted`, `onlineMetadataEnabled`, `onlineHideOwnedGames`,
  `onlineHideOwnedNonSteam`, `onlineHideOwnedNonSteamCloud`
- `activeProfileName`, `profiles`, `integrationsEnabled`, `featureToggles`
- `profileTriggersEnabled`, `factoryProfileTrigger`, `autoCollapseEnabled`
- `notificationsDisabled`, `notificationsDisabledAreas`, `showcaseSeen`
- Profile fields: `id`, `name`, `createdAt`, `snapshot`, `hidden`, `trigger`,
  `linkShelves`
- Button binding fields: `cardHideRemove`, `cardHighlightToggle`,
  `cardQuickLaunch`, `navSearch`, `navSideNav`, `navSidecarOpen`,
  `navSidecarClose`; disabled binding ids are stored in
  `buttonBindingsDisabled`
- `integrationsEnabled` and `featureToggles` are id-to-boolean maps

### Updates and diagnostics

- `updateNotifyEnabled`, `updateNotifyDismissedVersion`, `betaChannelEnabled`
- `verboseLoggingEnabled`, `devModeEnabled`
- `debugOverlayEnabled`, `debugOverlayCorner`, `debugOverlayVertical`,
  `debugOverlayFps`, `debugOverlayStats`, `debugOverlayPerShelf`,
  `debugOverlayOutlines`, `debugOverlayFocus`, `debugOverlayTransparent`

## Regular shelf configuration

- Identity/state: `id`, `title`, `enabled`, `hidden`, `limit`, `source`
- Ordering: `sort`, `sortReverse`, `manualOrder`, `manualBaseSort`,
  `manualBaseSortReverse`
- Size/highlights: `matchNativeSize`, `highlightFirst`, `highlightAll`,
  `highlightedAppIds`, `highlightRandom`
- Artwork/content: `enableLogo`, `enableIcon`, `enableDescription`,
  `descriptionScale`, `descriptionBelowLogo`, `logoBelowShelf`, `logoPosition`,
  `descriptionPosition`, `logoSize`, `logoTopOffset`, `fullPageShelf`,
  `iconVerticalAlign`, `shelfTitlePosition`, `gameNamePosition`,
  `playtimePosition`, `descriptionHeight`, `descriptionLogoGap`
- Visibility: `hideStatusLine`, `hideNewBadge`, `hideDiscountBadge`,
  `hideCompatIcons`, `hideNonSteamBadge`, `hideShelfTitle`, `hideGameNames`,
  `hideInstallIndicator`, `hideSeeMore`, `hideRefreshCard`
- Enrichment: `heroEnabled`, `gameInfoAbove`, `friendsPlayingOverlay`,
  `friendsPlayingOverlayRecent`, `dedupeByExactName`, `hiddenAppIds`
- Conditional behavior: `visibility`, `autoPin`, `autoCollapse`,
  `autoCollapseWhenEmpty`
- Decoration cards: `syntheticCards[].position`, `image`, `text`, `link`,
  `link.type`, `link.value`, `size`, `alpha`, `placeholder`, `heroImage`,
  `shadowMode`

## Smart shelf configuration

- Identity/state: `id`, `title`, `mode`, `enabled`, `hidden`, `limit`
- Ordering/refinement: `sort`, `sortReverse`, `manualOrder`, `manualBaseSort`,
  `manualBaseSortReverse`, `filterGroup`
- Every visual, visibility, hero, friend, dedupe, and hidden-app option listed
  for regular shelves
- Smart behavior: `refreshIntervalMinutes`, `smartParams`, `compositeModes`,
  `compositeCombine`, `visibleHours`, `visibleDaysOfWeek`, `visibility`,
  `autoPin`, `autoCollapse`, `autoCollapseWhenEmpty`
- Smart parameter keys: `maxPlaytimeMinutes`, `minPlaytimeMinutes`,
  `monthsAgo`, `yearsAgo`, `daysAgo`, `minDeckLevel`, `stalenessDays`,
  `cooldownDays`, `minMetacritic`, `minReviewScore`, `rotateEveryDays`,
  `maxSizeMb`, `batteryThresholdPct`, `minAchievementPct`,
  `includeRecentlyPlayed`
- Visibility range fields: `visibleHours[].start`, `end`, `days`; weekday
  values use `0` (Sunday) through `6` (Saturday)

## Shelf sources, filters, and sorting

- Source types: `collection`, `filter`, `external`, `smart`, `wishlist`, `store`,
  `composite`; `tab` remains only for Steam-native tab behavior, with
  TabMaster-specific discovery excluded.
- Composite source options: `combine`, `sources`, `childFilter`
- Wishlist/store options: `excludeOwned`, `excludeOwnedNonSteam`,
  `hideOwnedNonSteamCloud`, `childFilter`
- Filter group modes: `and`, `or`; every item supports `inverted` and `params`
- Persisted filter types: `installed`, `favorites`, `nonSteam`, `hidden`,
  `updatePending`, `isNew`, `deckCompatibility`, `playedWithinDays`,
  `playtimeRange`, `nameIncludes`, `nameRegex`, `friends`,
  `friendsPlayingNow`, `friendsPlayedRecently`, `storeTag`, `achievements`,
  `collection`, `developer`, `publisher`, `appIdList`, `cloudAvailable`,
  `controllerSupport`, `merge`, `shortcutType`, `appStatus`, `discount`,
  `recentlyActive`, `neglected`, `systemCompatibility`,
  `remotePlayLocation`, `priceRange`
- Filter parameter fields: `mode`, `levels`, `days`, `minHours`, `maxHours`,
  `text`, `pattern`, `friends`, `tags`, `collectionId`, `developers`,
  `publishers`, `appIds`, `items`, `kinds`, `groups`, `minDiscount`,
  `maxDiscount`. Every item also supports `inverted`; merge filters also use
  nested `mode` and `items`.
- Legacy flat filter fields: `favorites`, `hidden`, `nonSteam`, `installed`,
  `playedWithinDays`, `nameIncludes`, `nameRegex`, `deckCompatibility`,
  `minPlaytimeMinutes`, `maxPlaytimeMinutes`, `updatePending`, `sort`,
  `sortReverse`, `filterGroup`.
- Sorts: `alphabetical`, `recent`, `playtime`, `release_date`, `size_on_disk`,
  `metacritic`, `review_score`, `added`, `app_status`, `deck_compat`,
  `controller_support`, `price_low`, `discount_high`,
  `original_price_high`, `random`, `manual`; multi-key and per-key reverse are
  in scope.

### First-party v3 extension registry

These entries use the same public extension registry as third-party
integrations. They were retained unchanged in the Millennium build.

- Filter descriptors: `genres`, `categories`, `franchise`, `vrSupport`,
  `multiplayerType`, `familySharing`, `dlcOwned`, `soundtrackOwned`,
  `launchCount`, `avgSessionMinutes`, `neverCompleted`, `recentlyAbandoned`,
  `installedNeverPlayed`, `playedOnce`, `achievementPercentRange`,
  `storageDevice`, `installedSizeRange`, `compatDataQuality`, `emuDeckSystem`,
  `retroDeckSystem`, `heroicLauncher`, `lutrisApp`, `chiakiApp`,
  `moonlightApp`, `executableType`, `launchOptionTags`, `customTags`,
  `parserCategories`, `hiddenLauncherShortcuts`, `weightedFilter`,
  `priorityFilter`, `exclusionGroup`
- Sort descriptors: `most_launched`, `least_launched`, `longest_session`,
  `shortest_session`, `most_ignored`, `rediscovered_recently`,
  `completion_percent`, `closest_to_completion`, `rarest_achievements`,
  `newest_installed`, `oldest_installed`, `oldest_unplayed`,
  `newest_purchased`, `largest_install`, `smallest_install`, `ssd_priority`,
  `sd_priority`, `friends_playing_now`, `most_friends_owning`,
  `trending_among_friends`, `weighted_random`, `smart_random`,
  `seeded_random`, `rotating_daily_random`, `avoid_recently_shown`
- Shelf-source descriptors: `dynamic_collections`, `followed_games`,
  `ignored_games`, `dlc_source`, `soundtrack_source`, `pinned_games`,
  `history_source`, `session_queue_source`, `temporary_queue_source`,
  `recently_updated`, `with_events`, `with_workshop_updates`,
  `controller_specific_source`, `emudeck_collections`,
  `retrodeck_collections`, `heroic_library`, `lutris_library`,
  `moonlight_sessions`, `chiaki_sessions`

## Smart shelf modes

- `quick_play`, `not_started`, `deck_picks`, `rediscover`, `best_unplayed`,
  `interrupted`, `time_of_day`, `daily_pick`, `on_deck`, `recently_played`,
  `long_session`, `non_steam`, `random_pick`, `forgotten`, `spare_time`
- `soundtracks`, `videos`, `demos`, `cloud_games`
- `backlog_rescue`, `forgotten_gems`, `weekly_rotation`, `short_battery`,
  `long_session_night`, `travel_mode`, `hidden_gems`,
  `never_touched_classics`, `recent_hidden_installs`, `monthly_spotlight`,
  `seasonal_rotation`, `low_battery_mode`, `almost_finished`, `couch_gaming`,
  `coop_ready`, `party_games`, `friends_playing`, `custom`

## Public plugin API v4

- Registration: `registerShelfSource`, `registerSmartShelfSource`,
  `registerFilterType`, `registerSortOption`, `registerImportType`,
  `registerSavedFilter`, `registerExportHandler`, `registerImportHandler`,
  `registerSearchProvider`, `registerSideMenuProvider`,
  `registerContextProvider`, `registerWidgetProvider`, `registerShelfRenderer`,
  `registerMetadataProvider`, `registerStatisticsProvider`,
  `registerRecommendationProvider`, `registerTranslations`
- Registry reads: every corresponding `getRegistered*` method, including
  `getRegisteredImportTypesForTarget`
- State reads/subscriptions: `getShelves`, `getSmartShelves`,
  `getSavedFilters`, `getSavedSmartFilters`, `subscribeShelves`,
  `subscribeSmartShelves`, `subscribeSavedFilters`, `getFocusedCard`,
  `subscribeFocusedCard`, `getProfiles`, `getActiveProfile`,
  `subscribeProfiles`, `getIntegrations`, `subscribeIntegrations`,
  `getSettingsSnapshot`, `subscribeSettingsSnapshot`
- Runtime helpers: `getAssetUrls`, `getEnvironment`
- Built-in catalogue reads: `listTriggerCatalog`, `listShelfTemplates`,
  `listShortcuts`
- Excluded compatibility probe: `hasTabMaster`

## Implementation status

- All 25 in-scope backend RPCs are implemented in the Millennium Lua backend.
- Windows host identity, monitor count, CPU, and available-memory signals use
  read-only PowerShell/CIM adapters. Bluetooth/headphone rules remain explicitly
  unsupported on Windows, matching upstream's fail-open behavior off Linux.
- All settings, regular-shelf, smart-shelf, source, filter, sorting,
  decoration-card, profile, binding, diagnostics, online, and public API v4
  fields remain on their original frontend implementation.
- Settings are stored and returned as raw JSON documents after validation, so
  nested empty arrays and empty objects round-trip without Lua table-shape
  corruption.
- Backup naming, summaries, 24-hour automatic throttling, seven-day automatic
  expiry, ten-snapshot total retention (automatic snapshots pruned first),
  manual/import/pre-restore tags, import/export, and guarded paths are implemented.
- Local JSON I/O, image Base64 reads (8 MiB cap), EmuDeck, RetroDECK, Heroic,
  Lutris, Moonlight, and Chiaki adapters are implemented.
- Wishlist uses Steam's public `IWishlistService/GetWishlist` request. The
  upstream Decky cookie fallback is Linux-Chromium-specific and does not locate
  or decrypt the current Windows Steam cookie store; the Millennium Windows
  port therefore reports an empty/private wishlist clearly when the public
  endpoint supplies no items.

## Verification status

- TypeScript typecheck passes for the v3.1.0 integration.
- 698 Vitest tests pass across 59 files.
- 122 Python backend tests pass.
- The Millennium manifest, upstream provenance, frontend-to-Lua RPC contract,
  single-bundle build, and deterministic seven-file package pass automated
  validation. The package intentionally excludes settings, backups, and all
  other user data.
- Settings now carry schema version `1`; unversioned settings migrate forward
  without replacing valid data, while unknown future schema versions are
  preserved rather than silently downgraded.
- The Decky release build and package verifier continue to pass independently,
  keeping the upstream target intact.
- The prior v3.0.2 live build passed exact settings round-trips, public API v4
  exercises, Lua worker/QAM registration, and Big Picture home rendering.
- The hardened v3.1.0 build has passed a no-write deployment dry run against the
  detected live Millennium plugin directory. It has not been copied into the
  live plugin or revalidated through Steam/CDP; live deployment remains a
  separate explicit step so unrelated working-tree changes are not shipped by
  accident.

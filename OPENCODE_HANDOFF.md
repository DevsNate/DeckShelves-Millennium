# OpenCode Project Handoff

Updated: 2026-07-31 (America/Chicago)

## Progress after the initial handoff

- The public API fork now exists at `https://github.com/DevsNate/Deck-Shelves-API`.
- The three new public settings fields were committed and pushed as
  `77c9291092aed093a609946d79cb2f5aec77a705`.
- The plugin now points its `api` submodule at that fork and revision.
- Release preparation is committed at `2a8d89d` on
  `codex/release-3.1.1-prep` and PR #2 has passing CI.
- The `3.1.1` candidate is deployed with source/live hash parity, reports
  `pluginVersion: 3.1.1`, and passed the complete manual Steam acceptance
  matrix on 2026-07-31.
- No public release tag has been created.

## Read this first

The candidate is committed and pushed. Keep the root repository and pinned
submodules together; do not rewrite the release-prep branch or move submodule
revisions without rerunning the complete validation and live parity checks.

## Objective

Merge and publish the validated Deck Shelves Millennium `millennium-v3.1.1`
candidate after explicit user approval. The user has completed live acceptance
testing but has not approved or created the public release tag yet.

## Repository snapshot

- Workspace: `C:\Users\Nate\Documents\Codex Projects\DeckShelves-Millennium`
- Branch: `codex/release-3.1.1-prep`
- HEAD: `2a8d89dbd0e507a406d67992e91811b5b370a49b`
- Base `main`: `bdd9d8de43ab902edd46afe6a2dbd4ef13b538d1`
- Root remote: `https://github.com/DevsNate/DeckShelves-Millennium.git`
- Draft PR: `https://github.com/DevsNate/DeckShelves-Millennium/pull/2`
- Latest published release: `millennium-v3.1.0` / `Deck Shelves v3.1.0`
- Candidate port metadata and manifest say `3.1.1` while root `package.json`
  intentionally remains at upstream Deck Shelves `3.1.0`.
- The working tree and `api` submodule are clean.

Inspect the exact current state rather than relying only on this snapshot:

```powershell
git status --short --branch
git diff --check
git -C api status --short --branch
git submodule status
```

## User expectations and project boundaries

- This is the Millennium-for-Windows port. Validate against the actual Steam
  Big Picture/Home runtime, not only unit tests or generic Decky behavior.
- Keep the source checkout and the installed Millennium plugin separate. Only
  deploy to the live install as an explicit validation step.
- Native Steam focus and menu ownership are intentional. Do not replace them
  with custom D-pad interception or a second captured/native menu instance.
- Mouse right-click must use the card under the pointer. It must never borrow a
  previously controller-focused card when the pointer is on blank space.
- Blank shelf, hero, gutter, and page space must open neither a game menu nor
  Chromium's developer/browser context menu.
- Controller Menu and mouse right-click on native-backed cards should open the
  same full Steam-owned application menu.
- Closing any menu must preserve final-shelf controller navigation.
- ArtHero compatibility means keeping Deck Shelves as compact stacked rows.
  Do not conflate that behavior with forcing CSS Loader theme behavior.
- User-facing preferences should remain actual settings toggles, not manual
  code or CSS edits.

The detailed invariants and live test matrix are in:

- `docs/port/downstream-invariants.md`
- `docs/port/testing.md`

## What the unreleased working tree does

### 1. Native Steam context-menu ownership and blank-space safety

Primary files:

- `src/components/home/navPatches/menuButton.ts`
- `src/components/shelf/NativeGameCard.tsx`
- `src/components/shelf/NativeShelfCarousel.tsx`
- `src/core/nativeTitleInteractionOwner.ts`
- `src/test/components/menuButton.test.ts`
- `docs/port/downstream-invariants.md`
- `docs/port/testing.md`

The changes resolve mouse context menus from the element under the pointer,
deduplicate DOM/native menu dispatch, keep native-backed cards on their already
mounted Steam capsule, prevent stale focused-card fallback for mouse events,
and suppress Chromium's blank-space context menu. Native Recent Games cards are
included in the same ownership model.

### 2. Native title interaction, opacity, and auto-hide behavior

Primary files:

- `src/core/nativeTitleInteractionOwner.ts`
- `src/core/recentsTitleFade.ts`
- `src/components/shelf/shelfTitleBehavior.ts` (new)
- `src/components/DeckRow.tsx`
- `src/components/HomeInject.tsx`
- `src/components/shelf/shelfStylesheetTemplate.ts`
- `src/test/core/recentsTitleFade.test.ts`
- `src/test/components/shelfTitleBehavior.test.ts` (new)
- `src/test/components/shelfTitleOpacityCascade.test.ts` (new)

New global opt-in settings:

- `matchNativeShelfTitleOpacity`
- `autoHideShelfTitles`

Shelf title auto-hide mirrors Steam's Recent Games heading lifecycle: reveal
initially and when a card gains pointer/controller focus, then hide after eight
seconds. Cleanup restores original inline styles and attributes. The opacity
path mirrors the live native heading rather than hard-coding a theme color or
opacity.

### 3. Mini Carousel spacing compensation

Primary files:

- `src/components/shelf/miniCarouselSpacing.ts` (new)
- `src/core/cssLoaderDetect.ts`
- `src/components/HomeInject.tsx`
- `src/components/shelf/shelfStylesheetTemplate.ts`
- `src/test/components/miniCarouselSpacing.test.ts` (new)

New global opt-in setting:

- `scaleMiniCarouselSpacing`

This detects Mini Carousel scaling and compensates Deck Shelves row/title
spacing while keeping native card geometry intact. It is disabled by default.

### 4. Settings schema, persistence, UI, diagnostics, and public API snapshot

Primary files:

- `src/types.ts`
- `src/domain/defaults.ts`
- `sanitizer.py`
- `src/features/settings/controller/globalVisual.ts`
- `src/features/settings/settingsCategories.ts`
- `src/components/qam/sections/VisualGlobalSection.tsx`
- `src/components/qam/sidecar/GeneralTab.tsx`
- `src/runtime/diagnosticsInfo.ts`
- `src/core/settingsSnapshot.ts` (new)
- `src/core/pluginApi.ts`
- `api/src/types.ts` inside the pinned API submodule

The three settings are wired through defaults, Zod schema, Python sanitizer,
QAM and sidecar controls, hidden-settings categories, diagnostics, and the
public settings snapshot. All default to `false`.

The three English labels were added to all 19 locale files:

- `scale_mini_carousel_spacing`
- `match_native_shelf_title_opacity`
- `auto_hide_shelf_titles`

The non-English files currently contain the same English wording and may need
real translations later; this was not treated as a release blocker.

### 5. Home render/navigation hardening

Primary files:

- `src/components/home/renderState.ts` (new)
- `src/runtime/recentsReplace.tsx`
- `src/steam/index.ts`
- `src/core/webpackCompatDfl.ts`
- `src/test/components/homeRenderState.test.ts` (new)
- `src/test/steam/resolveTabChildFilter.test.ts` (new)

These changes isolate Home shelf render-state decisions and add regression
coverage around owned shelf children and Steam tab-child resolution.

## New untracked implementation/test files

These are part of the work and must not be omitted from the eventual commit:

```text
src/components/home/renderState.ts
src/components/shelf/miniCarouselSpacing.ts
src/components/shelf/shelfTitleBehavior.ts
src/core/settingsSnapshot.ts
src/test/components/homeRenderState.test.ts
src/test/components/menuButton.test.ts
src/test/components/miniCarouselSpacing.test.ts
src/test/components/shelfTitleBehavior.test.ts
src/test/components/shelfTitleOpacityCascade.test.ts
src/test/steam/resolveTabChildFilter.test.ts
```

These files are committed as part of the release candidate.

## Resolved `api` submodule integration

Current submodule state:

- Path: `api`
- Pinned commit: `77c9291092aed093a609946d79cb2f5aec77a705`
- Configured remote: `https://github.com/DevsNate/Deck-Shelves-API.git`
- State: clean and reachable from the public fork's `main` branch.
- Change: adds the three new booleans to `PublicSettingsSnapshot`.

The root gitlink, `.gitmodules`, and `ports/millennium/upstream.json` all record
the forked revision, so clean recursive CI checkouts receive the same API
contract used by the validated build.

## Validation already completed

On 2026-07-31, the committed `3.1.1` candidate passed:

```powershell
pnpm run check:millennium
```

Results:

- TypeScript typecheck passed.
- ESLint passed.
- Vitest passed: 65 test files, 743 tests.
- General validation passed.
- Millennium contract validation passed: 24 frontend RPCs and 28 Lua methods.
- Production Vite build passed: 510 modules transformed.
- Millennium package creation passed.
- Package verification passed: 7 files and no user data.
- `git diff --check` found no whitespace errors; PowerShell only reported the
  repository's normal LF-to-CRLF checkout warnings.

The local Python environment did not have `pytest`. The three newly affected
sanitizer tests were run directly and passed:

```powershell
node scripts/build/py.mjs -c "import sys; sys.path.insert(0, 'src/test'); import test_main as t; t.test_sanitize_settings_scale_mini_carousel_spacing_is_opt_in(); t.test_sanitize_settings_native_shelf_title_options_are_opt_in(); t.test_sanitize_new_home_visual_options_round_trip(); print('targeted sanitizer tests passed (3)')"
```

Non-blocking warnings observed:

- pnpm warned that `onlyBuiltDependencies` and `overrides` in the `api` and
  `host` package files do not take effect outside the workspace root.
- No local Lua/LuaJIT executable was found, so local Lua syntax validation was
  skipped. GitHub CI installed Lua 5.4 and passed the complete gate.

## Live installed state at handoff

Installed plugin path:

```text
C:\Program Files (x86)\Steam\millennium\plugins\deck-shelves
```

Steam CEF remote debugging was available at `127.0.0.1:8080`, with a live
`SharedJSContext` target at `https://steamloopback.host/routes/library/home`.

The final candidate was synced and activated through `SharedJSContext`:

| File | Source/live match | Source SHA-256 | Live SHA-256 |
| --- | --- | --- | --- |
| `.millennium/Dist/index.js` | Yes | `4291A375D4EFC57E8D4716F95AA2FF635FFB8FBCD6263FEA35F8B58C94F5A620` | same |
| `backend/main.lua` | Yes | `F56DE5764A4BD64D6C5ABEF228345F2D1C12896DA1396C328FBEF50A9FC80E2D` | same |
| `ports/millennium/plugin.json` -> live `plugin.json` | Yes | `0C1DA16DC7B18B51417CE06B103CABF27E31E0B3030DF424092E7B12F7525B02` | same |
| `ports/millennium/upstream.json` -> live `port/upstream.json` | Yes | `1043445839FD8F40389FEF3F65599EE2A6AB557F8B6D1B646162FEA33F38720C` | same |

The runtime reported `pluginVersion: 3.1.1`. The user completed every item in
the live acceptance matrix below and reported that all checks passed.

## Release completion status

All implementation, API, metadata, packaging, CI, deployment, and manual live
acceptance blockers are resolved. Remaining actions require explicit approval:

1. Merge PR #2 into `main`.
2. Create and push `millennium-v3.1.1` from the merged release commit.
3. Verify the release workflow publishes `Deck Shelves v3.1.1.zip` and its
   SHA-256 checksum.

## Required live acceptance matrix

The user verified all of the following in the actual Steam Big Picture Home:

- Controller Menu and mouse right-click on the same native-backed Deck Shelves
  card open the same full Steam application menu.
- Mouse right-click on a native Recent Games card opens the pointed game's
  Steam-owned menu.
- Right-clicking blank shelf, hero, page, and between-card gutter space opens
  neither a game menu nor Chromium's white browser/developer menu.
- Online/synthetic cards still use the safe Deck Shelves fallback menu.
- Closing each menu route preserves controller navigation.
- With Home Tabs hidden, pressing Down on a card in the final shelf keeps focus
  on that card instead of losing or escaping focus.
- Enabling/disabling `Scale spacing with Mini Carousel` changes only the
  intended spacing under the Mini Carousel CSS Loader theme.
- `Match native shelf title opacity` mirrors the current native Recent Games
  heading under both stock CSS and the active CSS Loader theme.
- `Auto hide shelf titles` reveals titles on mouse/controller card focus and
  hides them after the expected eight-second window.
- Turning the new options off restores the existing behavior without stale
  inline styles, data attributes, observers, or timers.
- ArtHero shelves remain compact/stacked and existing Ignore Art Hero behavior
  does not regress.
- Plugin unload/reload restores native Steam state.

## Suggested continuation sequence

```powershell
# 1. Reconfirm and preserve the current state.
git status --short --branch
git diff --stat
git -C api status --short --branch
git -C api diff -- src/types.ts

# 2. Resolve the API submodule ownership/commit issue before staging root work.

# 3. Update port version and Millennium changelog after choosing the release version.

# 4. Run the full local release gate.
pnpm run check:millennium

# 5. Deploy the candidate only when ready for live validation.
pnpm run deploy:millennium

# 6. Reload SharedJSContext or restart Steam as required, then perform the live matrix.

# 7. Verify source/live hashes and review the final clean diff.
git diff --check
git status --short --branch

# 8. Commit, push, verify GitHub CI, then create the matching millennium-v* tag.
```

## First instruction to give OpenCode

Use this as the opening request:

> Read `OPENCODE_HANDOFF.md` completely. Verify the clean
> `codex/release-3.1.1-prep` branch, pinned submodules, PR #2 CI, and current
> release metadata. All automated and live acceptance checks have passed. Stop
> for my explicit approval before merging, pushing `millennium-v3.1.1`, or
> publishing the GitHub release.

## Stop points requiring user approval

- Stop for explicit approval before pushing the final release tag or publishing
  the GitHub release.

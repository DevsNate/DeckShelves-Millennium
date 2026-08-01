# OpenCode Project Handoff

Updated: 2026-07-31 (America/Chicago)

## Progress after the initial handoff

- The public API fork now exists at `https://github.com/DevsNate/Deck-Shelves-API`.
- The three new public settings fields were committed and pushed as
  `77c9291092aed093a609946d79cb2f5aec77a705`.
- The plugin now points its `api` submodule at that fork and revision.
- Release preparation continues on `codex/release-3.2.0-prep`; no public
  release tag has been created.

## Read this first

This workspace contains the only complete copy of the current unreleased work.
Do **not** run `git reset`, `git clean`, `git checkout --`, reclone over this
directory, or update/reset submodules before preserving the changes.

The root working tree is dirty, and the `api` submodule is also dirty while
checked out at a detached commit. A normal root commit cannot capture dirty
submodule contents. Resolve the submodule deliberately before attempting a
release.

## Objective

Finish, live-validate, commit, and publish the next Deck Shelves Millennium
release. The recommended next public version is `millennium-v3.2.0` because the
working tree adds multiple user-facing features and behavior changes. The user
has not approved or created that release yet.

## Repository snapshot

- Workspace: `C:\Users\Nate\Documents\Codex Projects\DeckShelves-Millennium`
- Branch: `main`
- HEAD: `bdd9d8de43ab902edd46afe6a2dbd4ef13b538d1`
- HEAD is also the existing tag: `millennium-v3.1.0`
- Root remote: `https://github.com/DevsNate/DeckShelves-Millennium.git`
- Root `main` matched `origin/main` when this handoff was written.
- Latest published release: `millennium-v3.1.0` / `Deck Shelves v3.1.0`
- Current port metadata and manifest still say `3.1.0`.
- Before adding this handoff, the tracked diff contained 53 entries with about
  1,176 insertions and 94 deletions, plus 10 untracked implementation/test
  files.

Inspect the exact current state rather than relying only on this snapshot:

```powershell
git status --short --branch
git diff --stat
git diff --check
git -C api status --short --branch
git -C api diff -- src/types.ts
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
- `api/src/types.ts` inside the dirty submodule

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

`OPENCODE_HANDOFF.md` itself will also appear as untracked until committed.

## Critical `api` submodule issue

Current submodule state:

- Path: `api`
- Recorded/detached commit: `34dc141521f749f960e9e36e9747b17139de4220`
- Configured remote: `https://github.com/santojon/Deck-Shelves-API.git`
- Dirty file: `api/src/types.ts`
- Change: adds the three new booleans to `PublicSettingsSnapshot`.

The root release workflow checks out submodules recursively. It will only see a
committed gitlink SHA, never the dirty `api/src/types.ts` content currently on
disk. Before committing the root release, choose one of these deliberate paths:

1. Preferred: create/use a reachable `DevsNate` fork of Deck-Shelves-API,
   commit the interface change there, update `.gitmodules` if appropriate,
   update the root gitlink, and update `ports/millennium/upstream.json` with the
   new API submodule SHA.
2. If the public API should not change, redesign the root snapshot typing so
   this submodule edit is unnecessary, then restore the submodule only after
   confirming the replacement compiles and tests pass.

Do not simply stage the root `api` path while it remains dirty; that does not
record the edited file.

## Validation already completed

On 2026-07-31, this exact dirty working tree passed:

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
  skipped. The release workflow installs Lua 5.4, and `backend/main.lua` is
  unchanged in this working tree.

## Live installed state at handoff

Installed plugin path:

```text
C:\Program Files (x86)\Steam\millennium\plugins\deck-shelves
```

Steam CEF remote debugging was available at `127.0.0.1:8080`, with a live
`SharedJSContext` target at `https://steamloopback.host/routes/library/home`.

The freshly built source was **not** fully synced to the installed plugin:

| File | Source/live match | Source SHA-256 | Live SHA-256 |
| --- | --- | --- | --- |
| `.millennium/Dist/index.js` | No | `9D840B5795834D753F86AE41544A13E5756AAF0ACC4465AEFF35C57108BD2826` | `57D474B72E0BD7C5CFDBC7AA2833AD3E8D94BABDE203D6BEC7BD78B63BEF1BB6` |
| `sanitizer.py` | No | `ECDA761E8EBCEA9E2DAF2B3FDE4EE8327A6D05D7DA8DD971ECA856371E62F078` | `2EA9425DBB1A7D1CD9D9542E8C8641AD66318CDD0CA9E9AD087999CFDA860C65` |
| `backend/main.lua` | Yes | `8C3D7B1AE7B053C5DC323E3DAFCA8128EC6EB68A6B68BCC2156DBEC61B6D96A0` | same |
| `ports/millennium/plugin.json` -> live `plugin.json` | Yes | `87CF317ABD78BB5EEF48845357B5AF416086A621F9BAFCF47ADCC6877E838D57` | same |

Therefore, automated checks are green, but the combined current work has not
received final live acceptance testing.

## Release blockers

1. Preserve/commit the dirty `api` submodule change at a reachable SHA or
   remove the need for that edit.
2. Commit all root modifications and the 10 new implementation/test files.
3. Bump `ports/millennium/upstream.json` `portVersion` and
   `ports/millennium/plugin.json` `version` to the chosen new version.
4. Do **not** casually bump root `package.json`: its `3.1.0` version records the
   imported upstream version and `validate-millennium.mjs` requires it to match
   `upstream.version`.
5. Expand `CHANGELOG_MILLENNIUM.md` `[Unreleased]` into real release notes for
   the context-menu, title behavior, Mini Carousel spacing, settings, and
   navigation changes.
6. Deploy the candidate to the live Millennium install and complete the manual
   Steam Home test matrix below.
7. Re-run the full gate from the clean, committed tree and push it so GitHub CI
   validates what will actually be tagged.
8. Only then create/push `millennium-v3.2.0` (or another explicitly chosen
   version). The release workflow publishes on `millennium-v*` tags and checks
   that the tag exactly matches `portVersion`.

## Required live acceptance matrix

At minimum verify all of the following in the actual Steam Big Picture Home:

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

> Read `OPENCODE_HANDOFF.md` completely. Preserve the current dirty root and
> `api` submodule state. First audit the handoff against `git status`, the root
> diff, and `git -C api diff`. Then resolve the API submodule release blocker,
> prepare the recommended `millennium-v3.2.0` metadata and changelog, deploy and
> complete the documented live Steam acceptance matrix, rerun
> `pnpm run check:millennium`, and stop for my approval before publishing the
> GitHub release.

## Stop points requiring user approval

- Do not discard or rewrite any current implementation change without showing
  the reason and proposed replacement.
- Ask before creating a new GitHub API repository/fork if one does not already
  exist.
- Ask before deploying over the installed plugin if the user has started using
  a different live build.
- Stop for explicit approval before pushing the final release tag or publishing
  the GitHub release.

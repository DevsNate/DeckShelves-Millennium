# Millennium Downstream Invariants

This is the preservation ledger for behavior that differs from, or is more
specific than, upstream Decky. Review every invariant during an upstream merge,
even when Git reports no conflict in the named files.

The initial fixes were live-tested on Windows and shipped from commit
[`68b3fca`](https://github.com/DevsNate/DeckShelves-Millennium/commit/68b3fca)
in the unchanged `millennium-v3.1.0` release. Code and regression tests are the
authoritative implementation; this document explains why they must survive.

If an upstream or Steam change makes an invariant obsolete, replace it only in
a dedicated Millennium adaptation commit. Update this ledger, its automated
test, and the live acceptance result together.

## MILL-WIN-001: optional host probes must not steal Steam focus

- Invariant: `backend/main.lua` must not run optional display, OS, or
  performance probes through PowerShell via Millennium Lua `utils.exec()`.
- Reason: on Windows that path uses `_popen()`, which creates a visible outer
  `cmd.exe` window before a hidden PowerShell child can start. The console takes
  focus from Steam.
- Protected code: `backend/main.lua`, especially `get_display_state()`,
  `get_host_os()`, and `get_perf_snapshot()`.
- Required behavior: return safe static capability responses until Millennium
  exposes a genuinely windowless process API.
- Live check: reload the plugin and exercise Settings/QAM without any console
  flash, Steam focus loss, or surprise foreground window.

## MILL-NAV-001: the native carousel grid remains horizontally scrollable

- Invariant: `.ds-native-carousel-root` uses horizontal scrolling, not
  `overflow: visible`.
- Reason: Steam pans the borrowed carousel by changing `scrollLeft`. Chromium
  does not treat an `overflow: visible` element as a scroll container, so focus
  advances while the visible cards remain stationary.
- Protected code: `src/components/shelf/shelfStylesheetTemplate.ts`.
- Automated evidence: `src/test/components/shelfStylesheetTemplate.test.ts`.
- Live check: hold or tap Right with keyboard and controller past the initially
  visible cards. The row must pan at Steam's native pace and keep focus onscreen.

## MILL-NAV-002: Steam owns carousel focus timing and input modality

- Invariant: the borrowed carousel commits only through Steam's
  `setFocusedColumn` callback. Do not add a mid-animation
  `fnOnFocusedColumnChange` state update or custom keyboard/controller modality
  listeners around it.
- Reason: the intermediate React update interrupts Steam's native left/right
  handoff, particularly for a physical controller.
- Protected code: `src/components/shelf/NativeShelfCarousel.tsx`. The deleted
  `src/components/shelf/nativeCarouselInputMode.ts` must stay deleted unless a
  new Steam contract demonstrably requires it.
- Automated evidence: `src/test/components/nativeShelfCarousel.test.ts`.
- Live check: keyboard and controller Left/Right both pan identically to Recent
  Games, including repeated movement across several viewport widths.

## MILL-UI-001: native labels and status remain intact

- Invariant: navigation fixes must not remove the native game title, status,
  playtime, or other accepted visual-label work.
- Invariant: forced native hover follows Steam's real `.gpfocus` state and the
  existing title-ownership logic, not a custom input-mode flag.
- Protected code: `src/components/shelf/NativeGameCard.tsx` and
  `src/core/nativeTitleInteractionOwner.ts`.
- Automated evidence: `src/test/components/nativeGameCard.test.ts`.
- Live check: move focus with mouse, keyboard, and controller; exactly the
  expected focused/hovered card owns the native title and status presentation.

## MILL-UI-002: focused-card shadows cross shelf boundaries cleanly

- Invariant: Deck Shelves layout layers remain transparent. The outer row keeps
  its normal layout height while the borrowed native carousel gets 96 px of
  extra vertical paint area.
- Reason: an opaque shelf band or a clipped native scroll box produces a hard
  horizontal seam through Steam's colored focus shadow.
- Protected code: `src/components/shelf/shelfStylesheetTemplate.ts`.
- Automated evidence: `src/test/components/shelfStylesheetTemplate.test.ts`.
- Live check: inspect bright colored glows over several adjacent shelves. The
  shadow must fade naturally with no line, while shelf spacing remains unchanged.

## MILL-NAV-003: hidden Home Tabs create a handled final-shelf boundary

- Invariant: with **Hide Home Tabs** enabled, Down on the final rendered shelf
  returns handled through Steam's native `onMoveDown` hook and keeps the current
  card focused. Earlier shelves return false and retain Steam's normal handoff.
- Reason: suppressing the native Home Tabs leaves no navigation section below
  the final shelf; unhandled Down can clear the focused leaf or wrap to the first
  carousel, especially after a context menu closes.
- Protected code: `src/runtime/homeTabNavigation.ts` and
  `src/components/DeckRow.tsx`.
- Automated evidence: `src/test/runtime/homeTabNavigation.test.ts`.
- Live check: enable Hide Home Tabs, focus the last shelf, open and close both
  available card-menu paths, then press Down. Focus must remain on that card.
  Disable Hide Home Tabs and confirm native tabs return to the navigation path.

## MILL-MENU-001: preserve the safe smart-shelf mouse menu route

- Invariant: do not special-case mouse `contextmenu` on `.ds-card--native` to
  pass directly into the borrowed Steam capsule merely to make it resemble the
  controller menu.
- Reason: that rejected routing made the problematic mouse menu behavior apply
  to every shelf and did not fix the final-shelf navigation boundary.
- Protected code: `src/components/home/navPatches/menuButton.ts` and
  `src/core/steamGameMenu.ts`.
- Live check: smart-shelf mouse right-click keeps its safe fallback behavior;
  installed-shelf behavior remains unchanged; controller menu behavior remains
  native; closing any menu does not break subsequent shelf navigation.

## Rejected fixes that must not return during conflict resolution

- Do not make the native carousel scroll element `overflow: visible`.
- Do not add global keyboard/controller modality state to drive carousel focus.
- Do not update controlled focus through `fnOnFocusedColumnChange` mid-motion.
- Do not remove native labels or other accepted visual work to solve navigation.
- Do not route every native-card mouse context menu directly to the borrowed
  capsule.
- Do not restore PowerShell `_popen()` capability probes on Windows.

## Upstream-update sign-off

For every Decky import:

1. Review the protected paths above after the merge, including cleanly merged
   files.
2. Confirm each named regression test still exists and tests the same invariant.
3. Run `pnpm run check:millennium`.
4. Deploy locally and complete every live check in this ledger plus
   `docs/port/testing.md`.
5. Record intentional invariant changes as separate Millennium adaptation
   commits; never bury them inside the upstream merge commit.

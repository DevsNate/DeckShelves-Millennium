# Millennium Port Changelog

This changelog contains port-only work. Imported Deck Shelves features remain
documented in `CHANGELOG.md` and `RELEASE_NOTES.md`.

## [Unreleased]

## [3.2.0] - 2026-07-31

### Added

- Optional global controls to scale Deck Shelves spacing with CSS Loader's Mini
  Carousel, mirror native shelf-title opacity, and auto-hide shelf titles after
  native-style focus activity.
- Public settings-snapshot fields for the new visual controls.

### Improved

- Native-backed cards now use the same Steam-owned full application menu for
  mouse right-click and controller Menu actions, including native Recent Games
  cards.
- Right-clicking blank Home, shelf, hero, or card-gutter space no longer opens
  a stale game menu or Chromium's browser/developer context menu.
- Native shelf-title lifecycle, Home rendering, and navigation handling gained
  regression coverage for Millennium's Steam Big Picture runtime.

### Maintenance

- Added a downstream-invariant ledger and upstream-sync checklist covering the
  live-tested Windows focus, native carousel, label, shadow, hidden Home Tabs,
  and context-menu behaviors that must survive future Decky imports.

## [3.1.0] - 2026-07-22

### Added

- A dual-target manifest and packaging layout that leaves upstream Decky's
  root `plugin.json` intact.
- Machine-readable upstream, port-version, minimum-Millennium, and submodule
  revision metadata.
- Millennium contract validation for backend RPC coverage, direct Decky import
  boundaries, GamePad router mode, bootstrap registration, and Home Tabs
  teardown/resync behavior.
- Minimal reproducible Millennium packaging with content-hash verification and
  explicit rejection of settings, backups, source-control data, and dependency
  directories.
- Safe local Millennium deployment with dry-run support and an allowlisted
  runtime payload.
- A dedicated CI job and port maintenance documentation.
- Versioned settings documents with idempotent frontend migrations.
- An initial maintained Millennium port based on Deck Shelves 3.1.0.

### Improved

- Steam's native carousel cards now retain ownership of their game title,
  status, focus animation, and colored glow.
- Mouse drag-away and controller/keyboard navigation keep native card focus and
  title visibility synchronized.
- Native card glows can paint across shelf boundaries without being cut by the
  following shelf's background.
- Art Hero compatibility keeps Deck Shelves compact while preserving Steam's
  native title placement.

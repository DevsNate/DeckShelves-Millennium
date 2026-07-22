# Millennium Port Changelog

This changelog contains port-only work. Imported Deck Shelves features remain
documented in `CHANGELOG.md` and `RELEASE_NOTES.md`.

## [Unreleased]

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

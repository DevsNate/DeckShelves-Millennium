# Deck Shelves Millennium

Deck Shelves Millennium is an independently maintained port of
[Deck Shelves](https://github.com/santojon/Deck-Shelves) from Decky Loader to
[Millennium](https://github.com/SteamClientHomebrew/Millennium). The goal is to
keep Deck Shelves' shared frontend close to upstream while providing a native
Millennium bootstrap, GamePad router integration, Lua backend, packaging, and
Windows live-test workflow.

## Version and upstream baseline

The machine-readable source of truth is
[`ports/millennium/upstream.json`](ports/millennium/upstream.json). It records
two independent versions:

- `portVersion`: the version shipped to Millennium users.
- `upstream.version` and `upstream.commit`: the exact Decky release included.

The About page, diagnostics, updater, package name, and release process use the
port version on Millennium. Decky builds continue using `package.json`'s
upstream version.

## Build and verify

```powershell
pnpm install
pnpm run check:millennium
```

That command typechecks, runs unit tests, validates the port contracts, checks
Lua syntax when Lua is installed, builds the Millennium bundle, creates the
minimal release ZIP, and verifies every packaged file by content hash.

Individual commands:

```powershell
pnpm run validate:millennium
pnpm run build:millennium
pnpm run package:millennium
pnpm run verify:millennium-package
pnpm run deploy:millennium:dry-run
pnpm run deploy:millennium
```

`deploy:millennium` updates only `plugin.json`, `backend/main.lua`,
`.millennium/Dist/index.js`, and `port/upstream.json`. It does not delete or
replace `settings.json`, `settings.json.bak`, or `backups/`.

## Install a release

Download `Deck Shelves v3.1.0.zip` from the
[GitHub releases page](https://github.com/DevsNate/DeckShelves-Millennium/releases),
extract its `deck-shelves` directory into Millennium's plugins directory, then
enable the plugin and reload Steam.

## Documentation

- [Architecture and ownership](docs/port/architecture.md)
- [Updating from Decky upstream](docs/port/upstream-sync.md)
- [Windows development and live sync](docs/port/development-windows.md)
- [Testing and acceptance gates](docs/port/testing.md)
- [Feature support matrix](docs/port/support-matrix.md)
- [Release process](docs/port/releasing.md)
- [Millennium-specific changelog](CHANGELOG_MILLENNIUM.md)

Additional inherited documentation under `docs/` may describe shared upstream
behavior. The files under `docs/port/` are the source of truth for the
Millennium/Windows port.

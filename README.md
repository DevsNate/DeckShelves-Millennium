# Deck Shelves Millennium

[![CI](https://github.com/DevsNate/DeckShelves-Millennium/actions/workflows/ci.yml/badge.svg)](https://github.com/DevsNate/DeckShelves-Millennium/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/DevsNate/DeckShelves-Millennium?display_name=release&label=release)](https://github.com/DevsNate/DeckShelves-Millennium/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows)](https://github.com/DevsNate/DeckShelves-Millennium)
[![Millennium](https://img.shields.io/badge/loader-Millennium-1b2838)](https://github.com/SteamClientHomebrew/Millennium)

Deck Shelves Millennium adds configurable game shelves to Steam Big Picture on
Windows. Shelves can use collections, library tabs, filters, smart rules,
custom artwork, and Steam's native carousel cards.

This is an independently maintained Millennium port of
[Deck Shelves](https://github.com/santojon/Deck-Shelves) by Jonathan Santos and
contributors. It preserves the shared frontend and upstream Git history while
using a Millennium bootstrap, Lua backend, and Windows-focused packaging.

## Requirements

- Windows 10 or Windows 11
- Steam in Big Picture mode
- [Millennium](https://github.com/SteamClientHomebrew/Millennium) 3.0.0 or newer

## Install

1. Download **Deck Shelves v3.1.0.zip** from the
   [latest release](https://github.com/DevsNate/DeckShelves-Millennium/releases/latest).
2. Extract the included `deck-shelves` directory into Millennium's plugins
   directory.
3. Enable Deck Shelves in Millennium and reload Steam.

The release archive contains only runtime files. It does not include or replace
user settings, backups, source-control data, or development dependencies.

## Features

- Multiple configurable shelves on the Steam Big Picture home screen
- Collection, tab, filter, manual, smart, wishlist, and store-backed sources
- Steam-native game cards, titles, status text, focus animation, and glow
- Keyboard, controller, and mouse navigation
- Per-shelf hero artwork and Art Hero compatibility
- Import, export, migration, diagnostics, and update support

## Build and verify

Clone with submodules so the pinned shared API, host contract, and diagnostic
tools are available:

```powershell
git clone --recurse-submodules https://github.com/DevsNate/DeckShelves-Millennium.git
cd DeckShelves-Millennium
pnpm install
pnpm run check:millennium
```

GitHub displays the submodule directories as `api @ <commit>`,
`host @ <commit>`, and `deckprobe @ <commit>`. Those commit pins are
intentional: they make builds reproducible while keeping upstream updates easy
to review.

The verified package command writes `Deck Shelves v<version>.zip`:

```powershell
pnpm run package:millennium
pnpm run verify:millennium-package
```

## Documentation

- [Detailed Millennium build information](README_MILLENNIUM.md)
- [Windows development and live testing](docs/port/development-windows.md)
- [Architecture and ownership](docs/port/architecture.md)
- [Feature support matrix](docs/port/support-matrix.md)
- [Testing and acceptance gates](docs/port/testing.md)
- [Updating from Decky upstream](docs/port/upstream-sync.md)
- [Millennium changelog](CHANGELOG_MILLENNIUM.md)

## Upstream and licensing

Deck Shelves Millennium follows the upstream Deck Shelves releases recorded in
[`ports/millennium/upstream.json`](ports/millennium/upstream.json). Upstream
copyright and contributor attribution are preserved. See [LICENSE](LICENSE)
and [NOTICE.md](NOTICE.md).

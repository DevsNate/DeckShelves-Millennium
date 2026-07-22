# Contributing to Deck Shelves Millennium

Deck Shelves Millennium targets Steam Big Picture with Millennium on Windows.
Changes should preserve upstream mergeability while keeping loader-specific
code behind the existing host boundaries.

## Prerequisites

- Windows 10 or Windows 11
- Node.js 20 or newer
- pnpm 10 or newer
- Python 3.9 or newer
- Steam and Millennium 3.0.0 or newer for live testing
- Optional LuaJIT or Lua 5.4 for local Lua syntax validation

## Set up the repository

Clone recursively because `api`, `host`, and `deckprobe` are pinned Git
submodules:

```powershell
git clone --recurse-submodules https://github.com/DevsNate/DeckShelves-Millennium.git
cd DeckShelves-Millennium
pnpm install
```

If the repository was cloned without submodules, initialize them with:

```powershell
git submodule update --init --recursive
```

## Validate a change

Run the complete offline Millennium gate before opening a pull request:

```powershell
pnpm run check:millennium
```

This runs TypeScript, lint, unit tests, port-contract validation, Lua syntax
checking when Lua is installed, the production build, package generation, and
archive verification.

Changes to Steam UI integration should also be tested in Big Picture with both
mouse and controller/keyboard navigation. Follow the
[live acceptance checklist](docs/port/testing.md).

## Pull requests

- Explain the user-visible behavior and why the change is needed.
- Add or update tests for behavior changes.
- Update `CHANGELOG_MILLENNIUM.md` for Millennium-specific changes.
- Include screenshots or a recording for visual changes.
- Note whether the change affects upstream synchronization.

General shared-frontend improvements may also belong in the
[upstream Deck Shelves repository](https://github.com/santojon/Deck-Shelves).

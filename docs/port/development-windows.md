# Windows Development and Live Sync

## Prerequisites

- Node.js 20+
- pnpm version pinned by `package.json`
- Python 3
- Millennium and Steam
- Optional LuaJIT or Lua 5.4 for local syntax checking
- Steam CEF remote debugging on `127.0.0.1:8080`

## Build

```powershell
pnpm install
pnpm run validate:millennium
pnpm run build:millennium
```

The production bundle is `.millennium/Dist/index.js`.

## Configure the live target

Copy `.env.example` to `.env` and set either the exact plugin directory:

```text
MILLENNIUM_PLUGIN_DIR=C:\Program Files (x86)\Steam\millennium\plugins\deck-shelves
```

or its parent:

```text
MILLENNIUM_PLUGINS_DIR=C:\Program Files (x86)\Steam\millennium\plugins
```

The deploy command also checks common Steam/Millennium locations when these
variables are absent.

## Safe sync

Always inspect the target and payload first:

```powershell
pnpm run deploy:millennium:dry-run
```

Then build and sync:

```powershell
pnpm run deploy:millennium
```

Deployment is additive and allowlisted. It never recursively deletes the live
plugin directory. Settings and backups remain live-only data and must not be
copied back into source control or release packages.

After syncing, restart/reload Steam, confirm the backend readiness log, and run
the live checklist in `testing.md`.

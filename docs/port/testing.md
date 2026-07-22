# Millennium Testing

## Offline gate

`pnpm run check:millennium` is the required pre-merge gate. It covers:

- TypeScript type safety, the ESLint regression baseline, and Vitest tests.
- The inherited Deck Shelves static validator, including translation parity.
- Manifest/upstream metadata consistency.
- Frontend RPC names versus Lua implementations.
- Host import-boundary enforcement.
- GamePad router/bootstrap/Home Tabs invariants.
- Lua syntax when a Lua executable is available; CI requires it.
- Production bundle generation.
- Minimal package creation and exact archive verification.
- Rejection of user settings and backups from the archive.

The inherited Decky checks should remain green as an upstream-merge sanity
check:

```powershell
node scripts/build/validate.mjs
pnpm run build:release
```

## Live acceptance gate

Run against the installed Millennium plugin after every upstream import or
Steam UI compatibility change:

- Millennium backend reaches ready state without Lua errors.
- `settings.json` loads and an unchanged save round-trips exactly.
- QAM panel mounts and can open the full Settings route.
- Shelves mount after native Recent Games.
- D-pad down moves from native content into the first shelf.
- Horizontal navigation, More, Refresh, and card activation work.
- Returning from app details restores focus to the expected card/shelf.
- Hidden Home Tabs cannot receive controller focus, including after delayed
  Steam navigation-tree replacement.
- Disabling the option or unloading the plugin restores native tabs.
- ArtHero keeps each Deck Shelves carousel compact when compatibility is on.
- QAM, Steam menu, and home remount correctly after a Steam UI reload.

Use Deckprobe/CDP against `http://127.0.0.1:8080/json/list`. The highest-signal
existing probes are:

- `deckprobe/diag/probe_dpad_down_recents.cjs`
- `deckprobe/diag/diag_ds_focus.cjs`
- `deckprobe/diag/diag_mount.cjs`

Record the Steam client build, Millennium version, upstream commit, port
version, test counts, artifact SHA-256, and result in the release notes.

# Updating from Deck Shelves Upstream

The port preserves upstream merge ancestry. Import each tagged Deck Shelves
release as an isolated merge commit; do not squash the release into port work.

## Remote setup

For a published port repository, use:

```powershell
git remote rename origin decky-local-reference
git remote add origin <millennium-port-repository-url>
git remote rename upstream decky-upstream
git fetch origin --tags
git fetch decky-upstream --tags
```

`origin` should be the Millennium port. `decky-upstream` should be
`https://github.com/santojon/Deck-Shelves.git`. A local reference checkout is
optional and must not be the publishing remote.

## Sync procedure

Assume the candidate Decky release is `vX.Y.Z`:

```powershell
git fetch decky-upstream --tags
git switch -c sync/decky-vX.Y.Z
pnpm upstream:report vX.Y.Z --write upstream-sync-vX.Y.Z.md
git merge --no-ff vX.Y.Z
```

Resolve conflicts using the ownership table in `architecture.md`. Keep the
merge commit limited to the upstream import. Put required Millennium
adaptations in separate commits after the merge.

Then update `ports/millennium/upstream.json`:

- `upstream.version`
- `upstream.commit`
- changed submodule SHAs
- `portVersion`, only when preparing a port release

Run:

```powershell
pnpm run check:millennium
pnpm run deploy:millennium:dry-run
pnpm run deploy:millennium
```

Complete the live acceptance checklist in `testing.md` before publishing.

## Conflict hotspots

Review these areas even when Git reports no textual conflict:

- `src/index.tsx` and plugin lifecycle cleanup.
- `src/runtime/homePatch.tsx` and Home Tabs navigation suppression.
- `src/components/HomeInject.tsx` and `DeckRow.tsx` native focus props.
- Native card/carousel rendering and CSS Loader/ArtHero compatibility.
- Backend RPC additions or renamed parameters.
- Settings schema/default/sanitizer changes.
- Update, support, and issue-report URLs.
- New direct `@decky/*` imports.
- New translations and submodule revisions.

The sync is not complete merely because it builds. A Steam-private API timing
change can pass unit tests and still break controller navigation, so live CDP
and controller validation are mandatory.

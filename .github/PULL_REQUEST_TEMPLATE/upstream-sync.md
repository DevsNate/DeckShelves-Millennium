## Deck Shelves upstream sync

- Upstream tag/commit:
- Previous recorded upstream commit:
- Generated report:

### Import discipline

- [ ] The tagged upstream release was imported with an isolated merge commit.
- [ ] Millennium adaptations are separate commits after the merge.
- [ ] `ports/millennium/upstream.json` records the exact new commit and submodules.
- [ ] Shared conflict hotspots from `pnpm upstream:report` were reviewed.
- [ ] Every item in `docs/port/downstream-invariants.md` was reviewed, including
      protected files that merged without a textual conflict.
- [ ] None of the ledger's rejected fixes were reintroduced.

### Offline gates

- [ ] `node scripts/build/validate.mjs`
- [ ] `pnpm run check:millennium`
- [ ] The release ZIP contains no settings or backups.

### Live gates

- [ ] Backend ready and settings round-trip.
- [ ] QAM and Settings route mount.
- [ ] Native Recents -> first shelf D-pad navigation.
- [ ] Return-from-details focus restoration.
- [ ] Hidden Home Tabs remain outside the navigation tree after delayed rebuild.
- [ ] Final-shelf Down remains focused with Home Tabs hidden, before and after
      closing mouse/controller card menus.
- [ ] Keyboard and controller horizontal movement pan beyond the first viewport.
- [ ] Native labels/status and cross-shelf colored shadows remain intact.
- [ ] Windows plugin load/probes do not flash a console or steal Steam focus.
- [ ] ArtHero compact-row compatibility.
- [ ] Steam UI reload/unload cleanup.

### Release notes

- [ ] Imported upstream changes and Millennium-only adaptations are listed separately.
- [ ] Tested Steam client and Millennium versions are recorded.
- [ ] Artifact SHA-256 is recorded.

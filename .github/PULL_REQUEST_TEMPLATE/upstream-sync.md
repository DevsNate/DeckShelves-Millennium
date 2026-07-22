## Deck Shelves upstream sync

- Upstream tag/commit:
- Previous recorded upstream commit:
- Generated report:

### Import discipline

- [ ] The tagged upstream release was imported with an isolated merge commit.
- [ ] Millennium adaptations are separate commits after the merge.
- [ ] `ports/millennium/upstream.json` records the exact new commit and submodules.
- [ ] Shared conflict hotspots from `pnpm upstream:report` were reviewed.

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
- [ ] ArtHero compact-row compatibility.
- [ ] Steam UI reload/unload cleanup.

### Release notes

- [ ] Imported upstream changes and Millennium-only adaptations are listed separately.
- [ ] Tested Steam client and Millennium versions are recorded.
- [ ] Artifact SHA-256 is recorded.

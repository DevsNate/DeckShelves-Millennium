# Releasing the Millennium Port

## Before the first public release

1. Publish the port repository and make it the Git `origin` remote.
2. Set `portRepository` in `ports/millennium/upstream.json` to its full GitHub
   URL. Until configured, Millennium update checks and issue-report links are
   intentionally disabled rather than directing users to Decky-only releases.
3. Confirm `minimumMillenniumVersion` against the current supported release.
4. Confirm upstream and submodule SHAs.

## Versioning

The Millennium port has independent semantic versions. A release should be
named, for example:

```text
Deck Shelves v3.1.0 (based on Deck Shelves 3.1.0)
```

Increment `portVersion` for port fixes even when the upstream version is
unchanged. Importing a new upstream release does not force a specific port
version bump; choose it according to the user-visible change.

## Release gate

```powershell
pnpm run check:millennium
pnpm run deploy:millennium
```

Complete every live acceptance item in `testing.md`, then rerun:

```powershell
pnpm run package:millennium
pnpm run verify:millennium-package
```

Publish only `Deck Shelves v<portVersion>.zip`. Record its SHA-256
and separate release notes into:

- Imported upstream features/fixes.
- Millennium-only changes.
- Known limitations.
- Tested Steam and Millennium versions.

Millennium plugins do not automatically appear as updates merely because a
GitHub release exists. Submit each update through the official Millennium
Plugin Database review process.

# Millennium Port Architecture

## Design rule

The repository is a downstream of Deck Shelves, not an independent rewrite.
Shared feature and UI code should stay usable by upstream Decky. Loader,
backend, packaging, deployment, and live-runtime differences belong at an
explicit host boundary.

## Ownership map

| Area | Owner | Update rule |
| --- | --- | --- |
| `src/components`, `src/domain`, `src/steam` | Shared/upstream-first | Prefer host-neutral changes; inspect every upstream edit during a sync. |
| `src/runtime/host/decky.ts` | Decky adapter | The only production adapter allowed to import `@decky/*`. |
| `src/shims/millennium-*` | Millennium | Translate the Decky-shaped frontend boundary to Millennium. |
| `src/millennium-entry.tsx` | Millennium | Register the bundle and signal frontend readiness. |
| `backend/main.lua` | Millennium | Implement the frontend RPC contract with user-mode host access. |
| `vite.millennium.config.ts` | Millennium | Swap adapters and emit `.millennium/Dist/index.js`. |
| `ports/millennium/` | Millennium | Manifest, version/upstream metadata, and packaged README. |
| `scripts/*millennium*` | Millennium | Validate, package, deploy, and verify the port. |
| `plugin.json`, Python backend, Decky packaging | Upstream Decky | Keep compatible so future tagged merges remain reviewable. |

## Runtime flow

```text
Steam Big Picture
  -> Millennium entry
  -> Millennium API/UI shims
  -> shared Deck Shelves entry and feature code
  -> typed frontend call boundary
  -> Millennium Lua backend
  -> settings/backups and host probes
```

Millennium router operations explicitly select GamePad mode. Native Steam
focus hierarchy owns directional navigation; the port does not replace it with
a global D-pad interceptor. Host-specific capability gaps must fail softly and
be documented in `support-matrix.md`.

## Dependency boundaries

`pnpm run validate:millennium` enforces that production `@decky/*` imports are
limited to the shared entry point and Decky adapter. New host-specific behavior
should be added to the adapter/shim boundary rather than scattered through
feature components.

The Lua bridge does not provide compile-time payload checking. Every new RPC
must therefore have:

1. A single frontend wrapper/call site with an explicit request/result type.
2. A matching global Lua function.
3. Boundary validation for untrusted or persisted payloads.
4. A unit or contract test.

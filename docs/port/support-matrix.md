# Millennium Support Matrix

The authoritative baseline and versions live in
`ports/millennium/upstream.json`. This page describes capability policy; the
detailed field inventory remains in `MILLENNIUM_PARITY.md`.

| Capability | Status | Notes |
| --- | --- | --- |
| Regular and smart shelves | Supported | Shared upstream frontend. |
| Collections, filters, sorts, profiles, triggers | Supported | Subject to available Steam runtime data. |
| QAM and full Settings route | Supported | Millennium GamePad router mode. |
| Native controller navigation | Supported | Steam-native focus tree with port regression tests and live acceptance. |
| Lua settings/backups/import/export | Supported | Raw JSON preservation, guarded paths, schema-versioned frontend migrations. |
| CSS Loader/ArtHero compatibility | Supported | Runtime detection; compact shelf-row policy is Millennium-specific. |
| External launcher discovery | Supported where data exists | EmuDeck, RetroDECK, Heroic, Lutris, Moonlight, and Chiaki adapters fail softly. |
| Public wishlist | Degraded | No Windows authenticated-cookie fallback; private/empty results are reported clearly. |
| Bluetooth/headphone triggers on Windows | Unsupported | Returns `supported: false`; rules fail open. |
| TabMaster discovery/import | Excluded | Decky-specific integration; native Steam tab sources remain available. |
| Native graphical file picker | Excluded | Manual path entry remains available. |

Do not silently emulate an unavailable capability with unrelated behavior.
Expose the limitation, preserve settings, and fail softly.

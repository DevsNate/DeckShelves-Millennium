# ADR 0002: Keep Decky root files and stage Millennium separately

Status: Accepted

The root `plugin.json`, Decky build, Python backend, and Decky packaging remain
compatible with upstream. Millennium source metadata lives under
`ports/millennium/`, and its release artifact is assembled into a temporary
staging directory.

This avoids renaming upstream-owned files in every merge, prevents the Decky
and Millennium manifests from being confused, and ensures neither source files
nor live user data enter the Millennium archive.

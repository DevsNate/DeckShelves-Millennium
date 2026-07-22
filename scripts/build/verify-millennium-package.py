"""Verify that the Millennium archive is minimal, internally consistent, and user-data free."""

from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PORT_DIR = ROOT / "ports" / "millennium"
META = json.loads((PORT_DIR / "upstream.json").read_text(encoding="utf-8"))
SLUG = "deck-shelves"
ZIP_PATH = ROOT / f"Deck Shelves v{META['portVersion']}.zip"
REQUIRED = {
    f"{SLUG}/plugin.json",
    f"{SLUG}/backend/main.lua",
    f"{SLUG}/.millennium/Dist/index.js",
    f"{SLUG}/port/upstream.json",
    f"{SLUG}/README.md",
    f"{SLUG}/LICENSE",
    f"{SLUG}/NOTICE.md",
}
FORBIDDEN_PARTS = {"settings.json", "settings.json.bak", "backups", ".git", "node_modules"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    if not ZIP_PATH.is_file():
        raise SystemExit(f"Missing archive: {ZIP_PATH.name}; run pnpm package:millennium first")

    failures: list[str] = []
    with zipfile.ZipFile(ZIP_PATH) as archive:
        files = {name for name in archive.namelist() if not name.endswith("/")}
        missing = sorted(REQUIRED - files)
        extra = sorted(files - REQUIRED)
        if missing:
            failures.append("missing files: " + ", ".join(missing))
        if extra:
            failures.append("unexpected files: " + ", ".join(extra))
        for name in files:
            if any(part in FORBIDDEN_PARTS for part in Path(name).parts):
                failures.append(f"user/development data leaked into archive: {name}")

        manifest = json.loads(archive.read(f"{SLUG}/plugin.json"))
        packaged_meta = json.loads(archive.read(f"{SLUG}/port/upstream.json"))
        if manifest.get("version") != META["portVersion"]:
            failures.append("plugin version does not match ports/millennium/upstream.json")
        if packaged_meta != META:
            failures.append("packaged upstream metadata differs from the repository")

        expected_sources = {
            f"{SLUG}/backend/main.lua": ROOT / "backend" / "main.lua",
            f"{SLUG}/.millennium/Dist/index.js": ROOT / ".millennium" / "Dist" / "index.js",
        }
        for name, source in expected_sources.items():
            if name in files and sha256(archive.read(name)) != sha256(source.read_bytes()):
                failures.append(f"packaged file differs from build/source: {name}")

    if failures:
        print("Millennium package verification failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        raise SystemExit(1)
    print(f"[millennium-package] verified {ZIP_PATH.name} ({len(REQUIRED)} files, no user data)")


if __name__ == "__main__":
    main()

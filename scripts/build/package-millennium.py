"""Build the minimal, reproducible Deck Shelves Millennium release archive."""

from __future__ import annotations

import json
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PORT_DIR = ROOT / "ports" / "millennium"
META = json.loads((PORT_DIR / "upstream.json").read_text(encoding="utf-8"))
VERSION = META["portVersion"]
SLUG = "deck-shelves"
ZIP_PATH = ROOT / f"Deck Shelves v{VERSION}.zip"

PAYLOAD = {
    PORT_DIR / "plugin.json": Path("plugin.json"),
    ROOT / "backend" / "main.lua": Path("backend/main.lua"),
    ROOT / ".millennium" / "Dist" / "index.js": Path(".millennium/Dist/index.js"),
    PORT_DIR / "upstream.json": Path("port/upstream.json"),
    PORT_DIR / "README.md": Path("README.md"),
    ROOT / "LICENSE": Path("LICENSE"),
    ROOT / "NOTICE.md": Path("NOTICE.md"),
}


def main() -> None:
    missing = [str(source.relative_to(ROOT)) for source in PAYLOAD if not source.is_file()]
    if missing:
        raise SystemExit("Missing Millennium payload files:\n- " + "\n- ".join(missing))

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    with tempfile.TemporaryDirectory(prefix="deck-shelves-millennium-") as temp:
        stage = Path(temp) / SLUG
        for source, relative in PAYLOAD.items():
            destination = stage / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

        with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for file in sorted(stage.rglob("*")):
                if not file.is_file():
                    continue
                arcname = Path(SLUG) / file.relative_to(stage)
                info = zipfile.ZipInfo.from_file(file, arcname.as_posix())
                info.date_time = (2026, 1, 1, 0, 0, 0)
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                with file.open("rb") as source:
                    archive.writestr(info, source.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    print(f"[millennium-package] wrote {ZIP_PATH.name}")


if __name__ == "__main__":
    main()

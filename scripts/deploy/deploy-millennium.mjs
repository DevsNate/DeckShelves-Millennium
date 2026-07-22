import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noBuild = args.includes("--no-build");
const targetIndex = args.indexOf("--target");
const explicitTarget = targetIndex >= 0 ? args[targetIndex + 1] : null;

function registrySteamPath() {
  if (process.platform !== "win32") return null;
  for (const key of [
    "HKCU\\Software\\Valve\\Steam",
    "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam",
  ]) {
    const result = spawnSync("reg", ["query", key, "/v", "SteamPath"], { encoding: "utf8" });
    const match = result.stdout?.match(/SteamPath\s+REG_SZ\s+(.+)$/mi);
    if (match) return match[1].trim().replaceAll("/", "\\");
    const install = spawnSync("reg", ["query", key, "/v", "InstallPath"], { encoding: "utf8" });
    const installMatch = install.stdout?.match(/InstallPath\s+REG_SZ\s+(.+)$/mi);
    if (installMatch) return installMatch[1].trim();
  }
  return null;
}

function resolveTarget() {
  if (explicitTarget) return resolve(explicitTarget);
  if (process.env.MILLENNIUM_PLUGIN_DIR) return resolve(process.env.MILLENNIUM_PLUGIN_DIR);
  if (process.env.MILLENNIUM_PLUGINS_DIR) return resolve(process.env.MILLENNIUM_PLUGINS_DIR, "deck-shelves");

  const candidates = [];
  const steam = registrySteamPath();
  if (steam) {
    candidates.push(
      join(steam, "millennium", "plugins", "deck-shelves"),
      join(steam, "plugins", "deck-shelves"),
      join(steam, "plugin", "deck-shelves"),
    );
  }
  if (process.env.HOME) candidates.push(join(process.env.HOME, ".local", "share", "millennium", "plugins", "deck-shelves"));
  return candidates.find(existsSync) ?? candidates[0] ?? null;
}

const target = resolveTarget();
if (!target) {
  console.error("Could not locate the Millennium plugin directory. Set MILLENNIUM_PLUGIN_DIR or pass --target <deck-shelves-directory>.");
  process.exit(1);
}
if (basename(target).toLowerCase() !== "deck-shelves") {
  console.error(`Refusing to deploy outside a deck-shelves directory: ${target}`);
  process.exit(1);
}

const payload = [
  [join(root, "ports", "millennium", "plugin.json"), join(target, "plugin.json")],
  [join(root, "backend", "main.lua"), join(target, "backend", "main.lua")],
  [join(root, ".millennium", "Dist", "index.js"), join(target, ".millennium", "Dist", "index.js")],
  [join(root, "ports", "millennium", "upstream.json"), join(target, "port", "upstream.json")],
];

console.log(`[millennium-deploy] target: ${target}`);
console.log("[millennium-deploy] settings.json, settings.json.bak, and backups/ are outside the payload and will be preserved.");
if (!noBuild && !dryRun) {
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "build:millennium"], { cwd: root, stdio: "inherit" });
}

const missing = payload.filter(([source]) => !existsSync(source)).map(([source]) => source);
if (missing.length) {
  console.error("Missing payload files:\n- " + missing.join("\n- "));
  process.exit(1);
}

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const [source, destination] of payload) {
  if (dryRun) {
    console.log(`[dry-run] ${source} -> ${destination}`);
    continue;
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  const sourceHash = hash(source);
  const destinationHash = hash(destination);
  if (sourceHash !== destinationHash) throw new Error(`Hash mismatch after copying ${destination}`);
  console.log(`[millennium-deploy] ${destination} sha256=${destinationHash}`);
}

console.log(dryRun ? "[millennium-deploy] dry run complete; nothing was written" : "[millennium-deploy] sync complete; restart or reload Steam to activate the build");

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const deckyManifest = readJson(join(root, "plugin.json"));
const manifest = readJson(join(root, "ports", "millennium", "plugin.json"));
const metadata = readJson(join(root, "ports", "millennium", "upstream.json"));
const pkg = readJson(join(root, "package.json"));
const failures = [];

const requireValue = (condition, message) => { if (!condition) failures.push(message); };
requireValue(deckyManifest.name === "Deck Shelves" && Array.isArray(deckyManifest.flags), "root plugin.json must remain the upstream Decky manifest");
requireValue(!existsSync(join(root, "plugin.decky.json")), "plugin.decky.json is obsolete; keep the Decky manifest at plugin.json");
requireValue(manifest.name === "deck-shelves", "Millennium internal plugin name must be deck-shelves");
requireValue(manifest.common_name === "Deck Shelves", "Millennium common_name must be Deck Shelves");
requireValue(manifest.backendType === "lua", "Millennium backendType must be lua");
requireValue(manifest.useBackend === true && manifest.backend === "backend", "Millennium Lua backend must be explicitly enabled at backend/");
requireValue(manifest.version === metadata.portVersion, "Millennium manifest version must match upstream.json portVersion");
requireValue(pkg.version === metadata.upstream.version, "package.json version must match the recorded upstream version");
requireValue(/^\d+\.\d+\.\d+$/.test(metadata.portVersion), "portVersion must be stable SemVer");
requireValue(/^[0-9a-f]{40}$/.test(metadata.upstream.commit), "upstream commit must be a full Git SHA");

for (const path of ["backend/main.lua", "src/millennium-entry.tsx", "src/shims/millennium-api.ts", "src/shims/millennium-ui.ts", "vite.millennium.config.ts"]) {
  requireValue(existsSync(join(root, path)), `missing Millennium-owned file: ${path}`);
}

try {
  execFileSync("git", ["cat-file", "-e", `${metadata.upstream.commit}^{commit}`], { cwd: root, stdio: "ignore" });
} catch {
  failures.push(`recorded upstream commit is not present locally: ${metadata.upstream.commit}`);
}

function sourceFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) output.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) output.push(path);
  }
  return output;
}

const files = sourceFiles(join(root, "src"));
const allowedDeckyImports = new Set([
  "src/index.tsx",
  "src/runtime/host/decky.ts",
]);
for (const file of files) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel.startsWith("src/test/") || rel.startsWith("src/shims/")) continue;
  if (/from\s+["']@decky\//.test(readFileSync(file, "utf8")) && !allowedDeckyImports.has(rel)) {
    failures.push(`direct @decky import bypasses the host boundary: ${rel}`);
  }
}

const backendText = readFileSync(join(root, "backend", "main.lua"), "utf8");
const luaMethods = new Set([...backendText.matchAll(/^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((match) => match[1]));
const frontendMethods = new Set();
for (const file of files) {
  if (file.includes(`${resolve(root, "src", "test")}`) || file.includes(`${resolve(root, "src", "shims")}`)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/\bcall(?:<.*?>)?\(\s*["']([^"']+)["']/);
    if (match) frontendMethods.add(match[1]);
  }
}
for (const method of [...frontendMethods].sort()) {
  if (!luaMethods.has(method)) failures.push(`frontend RPC has no Millennium Lua implementation: ${method}`);
}

const millApi = readFileSync(join(root, "src", "shims", "millennium-api.ts"), "utf8");
const millEntry = readFileSync(join(root, "src", "millennium-entry.tsx"), "utf8");
const homePatch = readFileSync(join(root, "src", "runtime", "homePatch.tsx"), "utf8");
requireValue(millApi.includes("EUIMode?.GamePad") && millApi.includes("GAMEPAD_MODE"), "Millennium router operations must explicitly target GamePad mode");
requireValue(millApi.includes("__DECK_SHELVES_MILLENNIUM__ = true"), "Millennium runtime flag is missing");
requireValue(millEntry.includes("MILLENNIUM_BACKEND_IPC") && millEntry.includes("PLUGIN_LIST"), "Millennium entry registration contract is incomplete");
requireValue(homePatch.includes("restoreAllHomeTabs()"), "Home Tabs must be restored during teardown");
requireValue(homePatch.includes("scheduleHomeTabNavigationResync"), "late Home Tabs navigation-node resync protection is missing");

if (failures.length) {
  console.error(`Millennium validation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`[millennium] validation passed (${frontendMethods.size} frontend RPCs, ${luaMethods.size} Lua methods)`);

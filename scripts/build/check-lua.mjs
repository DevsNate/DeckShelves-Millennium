import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve("backend/main.lua");
if (!existsSync(file)) {
  console.error("Missing backend/main.lua");
  process.exit(1);
}

const candidates = process.platform === "win32"
  ? [["luajit", ["-b", file, process.platform === "win32" ? "NUL" : "/dev/null"]], ["lua", ["-e", `assert(loadfile([[${file}]]))`]]]
  : [["luajit", ["-b", file, "/dev/null"]], ["lua5.4", ["-e", `assert(loadfile([[${file}]]))`]], ["lua", ["-e", `assert(loadfile([[${file}]]))`]]];

for (const [command, args] of candidates) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") continue;
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Lua validation failed with ${command}\n`);
    process.exit(result.status ?? 1);
  }
  console.log(`[lua] syntax OK (${command})`);
  process.exit(0);
}

const message = "No Lua/LuaJIT executable found; install LuaJIT or Lua 5.4 to validate backend syntax.";
if (process.env.CI) {
  console.error(message);
  process.exit(1);
}
console.warn(`[lua] ${message} Skipping outside CI.`);

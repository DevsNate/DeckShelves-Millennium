import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const metadata = JSON.parse(readFileSync(join(root, "ports", "millennium", "upstream.json"), "utf8"));
const nextRef = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[1] && arg !== process.argv[0]);
const writeIndex = process.argv.indexOf("--write");
const outputPath = writeIndex >= 0 ? process.argv[writeIndex + 1] : null;

if (!nextRef) {
  console.error("Usage: pnpm upstream:report <new-upstream-tag-or-sha> [--write report.md]");
  process.exit(1);
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const oldRef = metadata.upstream.commit;
let nextCommit;
try {
  nextCommit = git("rev-parse", `${nextRef}^{commit}`);
} catch {
  console.error(`Cannot resolve ${nextRef}. Fetch upstream tags first.`);
  process.exit(1);
}

const lines = (value) => value ? value.split(/\r?\n/).filter(Boolean) : [];
const upstreamChanged = new Set(lines(git("diff", "--name-only", `${oldRef}..${nextCommit}`)));
const portChanged = new Set(lines(git("diff", "--name-only", oldRef, "HEAD")));
const hotspots = [...upstreamChanged].filter((path) => portChanged.has(path)).sort();
const portOnly = [...portChanged].filter((path) => !upstreamChanged.has(path)).sort();

const report = [
  `# Upstream sync report: ${metadata.upstream.version} -> ${nextRef}`,
  "",
  `- Recorded upstream: \`${oldRef}\``,
  `- Candidate upstream: \`${nextCommit}\``,
  `- Upstream changed paths: ${upstreamChanged.size}`,
  `- Shared conflict hotspots: ${hotspots.length}`,
  `- Existing port-only paths: ${portOnly.length}`,
  "",
  "## Shared conflict hotspots",
  "",
  ...(hotspots.length ? hotspots.map((path) => `- \`${path}\``) : ["- None"]),
  "",
  "## Port-only paths unaffected by this upstream range",
  "",
  ...(portOnly.length ? portOnly.map((path) => `- \`${path}\``) : ["- None"]),
  "",
].join("\n");

if (outputPath) {
  writeFileSync(outputPath, report, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  process.stdout.write(report);
}

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const output = resolve(process.argv[2] ?? "release");
mkdirSync(output, { recursive: true });
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", output], { encoding: "utf8" }));
const [pack] = Array.isArray(packed) ? packed : Object.values(packed) as any[];
const file = join(output, pack.filename);
const paths: string[] = pack.files.map((f: { path: string }) => f.path);
assert(paths.every(p => /^(dist\/|docker\/|package.json$|README.md$|LICENSE$)/.test(p)), "unexpected published file");
for (const required of ["dist/cli.js", "dist/index.js", "dist/index.d.ts", "docker/Dockerfile", "docker/tts/worker.py", "docker/tts/assets.json", "docker/sfx/LICENSE.txt"]) {
  assert(paths.includes(required), `package missing ${required}`);
}
const consumer = mkdtempSync(join(tmpdir(), "flow-reel-package-"));
try {
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", consumer, file], { stdio: "inherit" });
  const root = join(consumer, "node_modules/flow-reel");
  const manifest = JSON.parse(readFileSync(join(root, "docker/sfx/manifest.json"), "utf8"));
  for (const asset of Object.values(manifest.files) as { file: string; sha256: string }[]) {
    assert.equal(createHash("sha256").update(readFileSync(join(root, "docker/sfx", asset.file))).digest("hex"), asset.sha256);
  }
  const api = await import(pathToFileURL(join(root, "dist/index.js")).href);
  assert.equal(typeof api.demo, "function");
  const cli = spawnSync(join(consumer, "node_modules/.bin/flow-reel"), [], { encoding: "utf8" });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /usage: flow-reel/);
} finally { rmSync(consumer, { recursive: true, force: true }); }
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
writeFileSync(join(output, "package.json"), JSON.stringify({ file: pack.filename, version: pack.version, integrity: pack.integrity, sha256, commit }, null, 2) + "\n");
console.log(JSON.stringify({ file, version: pack.version, integrity: pack.integrity, sha256, commit }));

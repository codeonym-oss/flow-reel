import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { hashFiles } from "../../src/reel.ts";

it("accepts --no-sound on either side of the script, and rejects malformed compose options before Docker", () => {
  const run = (args: string[]) => spawnSync(process.execPath, ["src/cli.ts", ...args], {
    encoding: "utf8", env: { ...process.env, FLOW_REEL_IN_CONTAINER: "1" },
  });
  for (const args of [["compose", "--no-sound", "missing.ts"], ["compose", "missing.ts", "--no-sound"],
    ["compose", "missing.ts", "--out", "reels"],
    ["compose", "missing.ts", "--integration", "playwright", "--voice", "qwen3-tts-0.6b", "--speaker", "Aiden", "--language", "french"]]) {
    const result = run(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing.ts");
    expect(result.stderr).not.toContain("usage:");
  }
  for (const args of [["compose", "--no-sound"], ["compose", "demo.ts", "--no-sound", "--no-sound"],
    ["compose", "demo.ts", "--no-sfx"], ["compose", "a.ts", "b.ts"], ["compare", "a.reel", "b.reel", "--no-sound"],
    ["compose", "demo.ts", "--out"], ["compose", "demo.ts", "--out", "--no-sound"], ["compose", "demo.ts", "--out", "a", "--out", "b"],
    ["compose", "demo.ts", "--speaker"], ["compose", "demo.ts", "--speaker", "--no-sound"],
    ["compose", "demo.ts", "--speaker", "Ryan", "--speaker", "Aiden"], ["compose", "demo.ts", "--save-config", "--save-config"],
    ["verify"], ["verify", "a.reel", "b.reel"]]) {
    expect(run(args).status).toBe(2);
  }
}, 30_000); // 18 CLI processes in a row, beside the other unit files' processes: 10 s isn't enough on a busy runner.

it("checks the settings in the container before any adapter loads (GH-33)", () => {
  const result = spawnSync(process.execPath, ["src/cli.ts", "compose", "missing.ts", "--speaker", "Nobody"], {
    encoding: "utf8", env: { ...process.env, FLOW_REEL_IN_CONTAINER: "1" },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/^flow-reel: unknown speaker "Nobody"; known speakers: Aiden, /);
});

it("says that record is now compose", () => {
  const result = spawnSync(process.execPath, ["src/cli.ts", "record", "demo.ts"], { encoding: "utf8" });
  expect(result.status).toBe(2);
  expect(result.stderr).toBe("flow-reel: `record` is now `compose` (flow-reel 0.2)\n");
});

it("verifies a reel: 0 when whole, 1 naming a changed file, 2 for a folder that isn't a reel", () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-cli-"));
  try {
    writeFileSync(join(dir, "video.mp4"), "video");
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, script: { file: "demo.ts", sha256: "a".repeat(64) },
      composer: { version: "0.2.0", platform: "linux/amd64" }, integration: "playwright",
      files: hashFiles(dir, ["video.mp4"]) }));
    const verify = () => spawnSync(process.execPath, ["src/cli.ts", "verify", dir], { encoding: "utf8" });
    expect(verify()).toMatchObject({ status: 0, stdout: "Reel matches its manifest (1 file).\n" });
    writeFileSync(join(dir, "video.mp4"), "other");
    expect(verify()).toMatchObject({ status: 1, stdout: `${dir}: video.mp4 changed\n` });
    rmSync(join(dir, "manifest.json"));
    expect(verify()).toMatchObject({ status: 2, stderr: expect.stringContaining(`${dir}: manifest.json:`) });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("tells someone passing transcripts to compare reels instead", () => {
  const result = spawnSync(process.execPath, ["src/cli.ts", "compare", "a.transcript.json", "b.transcript.json"], { encoding: "utf8" });
  expect(result).toMatchObject({ status: 2, stderr: "flow-reel: compare takes two reel folders, e.g. demos/a.reel demos/b.reel\n" });
});

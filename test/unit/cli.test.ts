import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { COMMANDS } from "../../src/cli/commands.ts";
import { hashFiles } from "../../src/reel.ts";

const cli = (...args: string[]) => spawnSync(process.execPath, ["src/cli.ts", ...args], { encoding: "utf8" });

it("rejects malformed arguments with the command's usage, before anything runs", () => {
  for (const args of [["compose"], ["compose", "--no-sound"], ["compose", "demo.reel.ts", "--no-sound", "--no-sound"],
    ["compose", "demo.reel.ts", "--no-sfx"], ["compose", "a.reel.ts", "b.reel.ts"], ["compare", "a.reel", "b.reel", "--no-sound"],
    ["compose", "demo.reel.ts", "--out"], ["compose", "demo.reel.ts", "--out", "--no-sound"], ["compose", "demo.reel.ts", "--out", "a", "--out", "b"],
    ["compose", "demo.reel.ts", "--speaker"], ["compose", "demo.reel.ts", "--speaker", "Ryan", "--speaker", "Aiden"],
    ["verify"], ["verify", "a.reel", "b.reel"]]) {
    const { status, stderr } = cli(...args);
    expect({ args, status, stderr }).toEqual({ args, status: 2, stderr: expect.stringContaining(`usage: flow-reel ${args[0]} `) });
  }
}, 30_000); // 13 CLI processes in a row, beside the other unit files' processes: 10 s isn't enough on a busy runner.

it("takes --json for every command", () => {
  for (const [name, { usage }] of Object.entries(COMMANDS)) expect([name, usage]).toEqual([name, expect.stringContaining("[--json]")]);
});

it("lists its commands, and shows one command's usage", () => {
  expect(cli("--help")).toMatchObject({ status: 0, stdout: expect.stringMatching(/^usage: flow-reel <command>\n\n {2}init .*\n {2}compose /) });
  expect(cli("compose", "--help")).toMatchObject({ status: 0, stdout: expect.stringMatching(/^usage: flow-reel compose </) });
  for (const args of [[], ["demo"], ["toString"]]) expect(cli(...args)).toMatchObject({ status: 2, stderr: expect.stringContaining("usage: flow-reel <command>") });
});

it("accepts flags on either side of the script, and checks the settings before it looks for an engine (GH-33)", () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-cli-"));
  const env = { ...process.env, FLOW_REEL_DATA_DIR: join(dir, "data"), PATH: "" };
  const run = (...args: string[]) => spawnSync(process.execPath, ["src/cli.ts", ...args], { encoding: "utf8", env });
  const script = join(dir, "reels/demo.reel.ts");
  try {
    expect(run("compose", "--no-sound", script)).toMatchObject({ status: 1, stderr: `flow-reel: ${script} doesn't exist\n` });
    expect(run("init", dir, "--title", "Shop").status).toBe(0);
    writeFileSync(script, "");
    expect(run("compose", script, "--speaker", "Nobody")).toMatchObject({ status: 1, stderr: expect.stringMatching(/^flow-reel: unknown speaker "Nobody"; known speakers: Aiden, /) });
    for (const args of [["--no-sound", script], [script, "--no-sound", "--out", join(dir, "o"), "--speaker", "Aiden", "--language", "french"]]) {
      expect(run("compose", ...args)).toMatchObject({ status: 1, stderr: "flow-reel: flow-reel needs Docker or Podman: neither was found on PATH\n" });
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 30_000);

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
    const verify = (...args: string[]) => spawnSync(process.execPath, ["src/cli.ts", "verify", dir, ...args], { encoding: "utf8" });
    const json = (status: number, errors: string[], differences: string[]) =>
      expect(verify("--json")).toMatchObject({ status, stdout: `${JSON.stringify({ reel: dir, matches: status === 0, errors, differences })}\n`, stderr: "" });
    expect(verify()).toMatchObject({ status: 0, stdout: "Reel matches its manifest (1 file).\n" });
    json(0, [], []);
    writeFileSync(join(dir, "video.mp4"), "other");
    expect(verify()).toMatchObject({ status: 1, stdout: `${dir}: video.mp4 changed\n` });
    json(1, [], [`${dir}: video.mp4 changed`]);
    // Comparing it with itself stops at the same difference.
    expect(cli("compare", dir, dir, "--json")).toMatchObject({ status: 2, stdout: expect.stringContaining(`"matches":false,"errors":["${dir}: video.mp4 changed"`) as string });
    rmSync(join(dir, "manifest.json"));
    expect(verify()).toMatchObject({ status: 2, stderr: expect.stringContaining(`${dir}: manifest.json:`) });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("tells someone passing transcripts to compare reels instead", () => {
  const result = spawnSync(process.execPath, ["src/cli.ts", "compare", "a.transcript.json", "b.transcript.json"], { encoding: "utf8" });
  expect(result).toMatchObject({ status: 2, stderr: expect.stringContaining("flow-reel: compare takes two reel folders, e.g. demos/a.reel demos/b.reel\n") });
});

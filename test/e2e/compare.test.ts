import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { hashFiles, listReelFiles } from "../../src/reel.ts";

const transcript = () => ({ version: 2, script: "demo.ts",
  video: { file: "video.mp4", width: 960, height: 540, fps: 30, durationMs: 2000 },
  steps: [{ index: 0, comment: "Hello", startMs: 500, actionEndMs: 700, endMs: 1000 }] });

/** A small reel on disk: its transcript, a stand-in video, and a manifest listing both. */
function writeReel(dir: string, value: unknown) {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "transcript.json"), typeof value === "string" ? value : JSON.stringify(value));
  writeFileSync(join(dir, "video.mp4"), "video");
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, script: { file: "demo.ts", sha256: "a".repeat(64) },
    composer: { version: "0.2.0", platform: "linux/amd64" }, integration: "playwright", files: hashFiles(dir, listReelFiles(dir)) }));
}

it("compares reels on the host without external executables, with distinct failure statuses", () => {
  const dir = resolve("test/e2e/out/compare");
  const a = join(dir, "a.reel"); const b = join(dir, "b.reel");
  const value = transcript();
  writeReel(a, value); writeReel(b, value);
  const cli = (...args: string[]) => spawnSync(process.execPath, ["dist/cli.js", ...args], {
    encoding: "utf8", env: { ...process.env, PATH: "/no-executables", FLOW_REEL_IN_CONTAINER: "1" },
  });
  expect(cli("compare", a, b)).toMatchObject({ status: 0, stdout: expect.stringContaining("match") });
  expect(cli("verify", a)).toMatchObject({ status: 0 });
  value.steps[0].comment = "Different"; writeReel(b, value);
  expect(cli("compare", a, b)).toMatchObject({ status: 1, stdout: expect.stringContaining("steps[0].comment") });
  value.steps[0].endMs = 3000; writeReel(b, value);
  expect(cli("compare", a, b)).toMatchObject({ status: 2, stderr: expect.stringContaining("b.reel") });
  writeReel(b, "{");
  expect(cli("compare", a, b)).toMatchObject({ status: 2, stderr: expect.stringContaining("b.reel") });
  writeReel(b, transcript()); writeFileSync(join(b, "video.mp4"), "altered");
  expect(cli("compare", a, b)).toMatchObject({ status: 2, stderr: expect.stringContaining(`${b}: video.mp4 changed`) });
  expect(cli("compare", a).status).toBe(2);
  expect(cli("compare", a, b, "extra").status).toBe(2);
  expect(cli("compare", a, join(dir, "missing.reel")).status).toBe(2);
});

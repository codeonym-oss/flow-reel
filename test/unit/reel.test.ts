import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { hashFiles, listReelFiles, verifyReel } from "../../src/reel.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A small reel: two files, a work file, and its manifest. */
const reel = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-reel-"));
  dirs.push(dir);
  mkdirSync(join(dir, "audio")); mkdirSync(join(dir, "work"));
  writeFileSync(join(dir, "transcript.json"), "{}");
  writeFileSync(join(dir, "audio", "000.wav"), "clip");
  writeFileSync(join(dir, "work", "capture.mp4"), "big");
  const manifest = { version: 1, script: { file: "demo.ts", sha256: "a".repeat(64) },
    composer: { version: "0.2.0", platform: "linux/amd64" }, integration: "playwright",
    files: hashFiles(dir, listReelFiles(dir)) };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
  return dir;
};

it("lists a reel's files sorted, without the manifest and work/", () => {
  expect(listReelFiles(reel())).toEqual(["audio/000.wav", "transcript.json"]);
});

it("verifies a whole reel", () => {
  expect(verifyReel(reel())).toMatchObject({ errors: [], differences: [] });
});

it("names each missing, extra or changed file, and ignores work/", () => {
  const dir = reel();
  rmSync(join(dir, "transcript.json"));
  writeFileSync(join(dir, "notes.txt"), "");
  writeFileSync(join(dir, "audio", "000.wav"), "other");
  writeFileSync(join(dir, "work", "capture.mp4"), "changed");
  expect(verifyReel(dir)).toMatchObject({ errors: [], differences: [
    "transcript.json is missing", "notes.txt is not in the manifest", "audio/000.wav changed",
  ] });
});

it("reports a folder that isn't a reel as an error", () => {
  const dir = reel();
  rmSync(join(dir, "manifest.json"));
  expect(verifyReel(dir).errors).toEqual([expect.stringMatching(/^manifest\.json: ENOENT/)]);
  expect(verifyReel(join(dir, "nowhere")).errors).toEqual(["not a folder"]);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 2 }));
  expect(verifyReel(dir).errors).toContain("manifest.json: version must be 1");
});

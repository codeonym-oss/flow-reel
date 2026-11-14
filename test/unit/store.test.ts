import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { folderStore } from "../../src/adapters/folder/store.ts";
import type { Reel } from "../../src/composer/ports.ts";
import { verifyReel } from "../../src/reel.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const scriptIn = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-store-"));
  dirs.push(dir);
  return { dir, script: join(dir, "settings.ts") };
};

const transcript = { version: 2 as const, script: "settings.ts", steps: [],
  video: { file: "video.mp4", width: 1920, height: 1080, fps: 30, durationMs: 0 } };
const events = { version: 3 as const, events: [] };
const about = { script: { file: "settings.ts", sha256: "a".repeat(64) }, composer: { version: "0.2.0", platform: "linux/amd64" },
  integration: "playwright", voice: { adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0 } };

/** What compose does: stage a video and a clip, then commit. */
const compose = (reel: Reel, video = "video") => {
  writeFileSync(reel.work.stagedVideo, video);
  mkdirSync(reel.audioDir, { recursive: true });
  writeFileSync(join(reel.audioDir, "000.wav"), "clip");
  reel.commit({ transcript, events, captions: { srt: "srt", vtt: "vtt" }, about });
};

it("builds the reel in a partial folder, with self-ignoring work files and the audio inside", () => {
  const { dir, script } = scriptIn();
  const reel = folderStore.open(script);
  const partial = join(dir, "settings.reel.partial");
  const work = join(partial, "work");
  expect(reel.work).toEqual({
    capture: join(work, "capture.mp4"), master: join(work, "master.mp4"), masterInfo: join(work, "master.json"),
    stagedVideo: join(work, "delivery.mp4"), voiceBus: join(work, "voice.wav"),
  });
  expect(readFileSync(join(work, ".gitignore"), "utf8")).toBe("*\n");
  expect(reel.audioDir).toBe(join(partial, "audio"));
  expect(reel.audioRoot).toBe(partial);
  expect(reel.videoFile).toBe("video.mp4");
});

it("commits one reel with fixed names and a manifest that verifies, and nothing else beside the script", () => {
  const { dir, script } = scriptIn();
  writeFileSync(script, "");
  compose(folderStore.open(script));
  const reel = join(dir, "settings.reel");
  expect(readdirSync(dir).sort()).toEqual(["settings.reel", "settings.ts"]);
  expect(readdirSync(reel).sort()).toEqual([
    "audio", "captions.srt", "captions.vtt", "events.json", "manifest.json", "transcript.json", "video.mp4", "work",
  ]);
  expect(readFileSync(join(reel, "transcript.json"), "utf8")).toBe(`${JSON.stringify(transcript, null, 2)}\n`);
  expect(readFileSync(join(reel, "events.json"), "utf8")).toBe(`${JSON.stringify(events, null, 2)}\n`);
  const manifest = JSON.parse(readFileSync(join(reel, "manifest.json"), "utf8"));
  expect(manifest).toMatchObject({ version: 1, ...about });
  expect(manifest.files.map((f: { path: string }) => f.path)).toEqual([
    "audio/000.wav", "captions.srt", "captions.vtt", "events.json", "transcript.json", "video.mp4",
  ]);
  expect(verifyReel(reel)).toMatchObject({ errors: [], differences: [] });
});

it("replaces the previous reel only when the new one commits", () => {
  const { dir, script } = scriptIn();
  compose(folderStore.open(script), "first");
  const reel = join(dir, "settings.reel");
  folderStore.open(script); // a compose that fails before committing
  expect(readFileSync(join(reel, "video.mp4"), "utf8")).toBe("first");
  expect(verifyReel(reel).differences).toEqual([]);
  expect(existsSync(join(dir, "settings.reel.partial"))).toBe(true);
  compose(folderStore.open(script), "second");
  expect(readFileSync(join(reel, "video.mp4"), "utf8")).toBe("second");
  expect(existsSync(join(dir, "settings.reel.partial"))).toBe(false);
});

it("clears a leftover partial folder when a compose starts", () => {
  const { dir, script } = scriptIn();
  folderStore.open(script);
  writeFileSync(join(dir, "settings.reel.partial", "stale.txt"), "");
  compose(folderStore.open(script));
  expect(existsSync(join(dir, "settings.reel", "stale.txt"))).toBe(false);
});

it("puts the reel in outDir, named after the script without its extension", () => {
  const { dir } = scriptIn();
  const out = join(dir, "reels");
  compose(folderStore.open(join(dir, "tour.mts"), out));
  expect(readdirSync(out)).toEqual(["tour.reel"]);
  expect(readdirSync(dir).sort()).toEqual(["reels"]);
});

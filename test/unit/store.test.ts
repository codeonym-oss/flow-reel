import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { folderStore } from "../../src/adapters/folder/store.ts";
import type { Reel } from "../../src/composer/ports.ts";
import { verifyReel } from "../../src/reel.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const reelIn = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-store-"));
  dirs.push(dir);
  return { dir, reel: join(dir, "settings.reel") };
};

const transcript = { version: 2 as const, script: "settings.ts", steps: [],
  video: { file: "video.mp4", width: 1920, height: 1080, fps: 30, durationMs: 0 } };
const events = { version: 6 as const, autoZoom: true, events: [] };
const about = { script: { file: "settings.ts", sha256: "a".repeat(64) }, composer: { version: "0.2.0", platform: "linux/amd64" },
  integration: "playwright", voice: { adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0, language: "english" } };

/** What compose does: stage a video and a clip, then commit. */
const compose = (reel: Reel, video = "video") => {
  writeFileSync(reel.work.stagedVideo, video);
  mkdirSync(reel.audioDir, { recursive: true });
  writeFileSync(join(reel.audioDir, "000.wav"), "clip");
  reel.commit({ transcript, events, captions: { srt: "srt", vtt: "vtt" }, about });
};

it("points at the reel already on disk, whose clips are the reel cache", () => {
  const { dir, reel: target } = reelIn();
  expect(folderStore.open(target).previous).toBeUndefined();
  compose(folderStore.open(target));
  expect(folderStore.open(target).previous).toBe(join(dir, "settings.reel"));
});

it("builds the reel in a partial folder, with self-ignoring work files and the audio inside", () => {
  const { dir, reel: target } = reelIn();
  const reel = folderStore.open(target);
  const partial = join(dir, "settings.reel.partial");
  const work = join(partial, "work");
  expect(reel.work).toEqual({
    capture: join(work, "capture.mp4"), masterInfo: join(work, "master.json"),
    stagedVideo: join(work, "delivery.mp4"), voiceBus: join(work, "voice.wav"),
  });
  expect(readFileSync(join(work, ".gitignore"), "utf8")).toBe("*\n");
  expect(reel.audioDir).toBe(join(partial, "audio"));
  expect(reel.audioRoot).toBe(partial);
  expect(reel.videoFile).toBe("video.mp4");
});

it("commits one reel with fixed names and a manifest that verifies, and nothing else beside it", () => {
  const { dir, reel: target } = reelIn();
  compose(folderStore.open(target));
  const reel = join(dir, "settings.reel");
  expect(readdirSync(dir)).toEqual(["settings.reel"]);
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
  const { dir, reel: target } = reelIn();
  compose(folderStore.open(target), "first");
  const reel = join(dir, "settings.reel");
  folderStore.open(target); // a compose that fails before committing
  expect(readFileSync(join(reel, "video.mp4"), "utf8")).toBe("first");
  expect(verifyReel(reel).differences).toEqual([]);
  expect(existsSync(join(dir, "settings.reel.partial"))).toBe(true);
  compose(folderStore.open(target), "second");
  expect(readFileSync(join(reel, "video.mp4"), "utf8")).toBe("second");
  expect(existsSync(join(dir, "settings.reel.partial"))).toBe(false);
});

it("clears a leftover partial folder when a compose starts", () => {
  const { dir, reel: target } = reelIn();
  folderStore.open(target);
  writeFileSync(join(dir, "settings.reel.partial", "stale.txt"), "");
  compose(folderStore.open(target));
  expect(existsSync(join(dir, "settings.reel", "stale.txt"))).toBe(false);
});

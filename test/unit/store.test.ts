import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { folderStore } from "../../src/adapters/folder/store.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const scriptIn = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-store-"));
  dirs.push(dir);
  return { dir, script: join(dir, "settings.ts") };
};

it("keeps work files in a self-ignoring .flow-reel folder and the audio beside the script", () => {
  const { dir, script } = scriptIn();
  const cassette = folderStore.open(script);
  const work = join(dir, ".flow-reel", "settings");
  expect(cassette.work).toEqual({
    capture: join(work, "capture.mp4"), master: join(work, "master.mp4"), masterInfo: join(work, "master.json"),
    stagedVideo: join(work, "delivery.mp4"), voiceBus: join(work, "voice.wav"),
  });
  expect(existsSync(work)).toBe(true);
  expect(readFileSync(join(dir, ".flow-reel", ".gitignore"), "utf8")).toBe("*\n");
  expect(cassette.audioDir).toBe(join(dir, "settings.audio"));
  expect(cassette.audioRoot).toBe(dir);
  expect(cassette.videoFile).toBe("settings.mp4");
});

it("leaves an existing .gitignore in the work folder alone", () => {
  const { dir, script } = scriptIn();
  folderStore.open(script);
  writeFileSync(join(dir, ".flow-reel", ".gitignore"), "kept\n");
  folderStore.open(script);
  expect(readFileSync(join(dir, ".flow-reel", ".gitignore"), "utf8")).toBe("kept\n");
});

it("publishes the staged video with its transcript, captions and event log beside the script", () => {
  const { dir, script } = scriptIn();
  const cassette = folderStore.open(script);
  writeFileSync(cassette.work.stagedVideo, "video");
  const transcript = { version: 1 as const, script: "settings.ts", steps: [],
    video: { file: "settings.mp4", width: 1920, height: 1080, fps: 30, durationMs: 0 } };
  const events = { version: 2 as const, events: [] };
  cassette.commit({ transcript, events, captions: { srt: "srt", vtt: "vtt" } });
  expect(readdirSync(dir).sort()).toEqual([
    ".flow-reel", "settings.events.json", "settings.mp4", "settings.srt", "settings.transcript.json", "settings.vtt",
  ]);
  expect(readFileSync(join(dir, "settings.mp4"), "utf8")).toBe("video");
  expect(existsSync(cassette.work.stagedVideo)).toBe(false);
  expect(readFileSync(join(dir, "settings.transcript.json"), "utf8")).toBe(`${JSON.stringify(transcript, null, 2)}\n`);
  expect(readFileSync(join(dir, "settings.events.json"), "utf8")).toBe(`${JSON.stringify(events, null, 2)}\n`);
  expect(readFileSync(join(dir, "settings.srt"), "utf8")).toBe("srt");
});

it("names a .mts script's results without the extension", () => {
  const { dir } = scriptIn();
  expect(folderStore.open(join(dir, "tour.mts")).videoFile).toBe("tour.mp4");
});

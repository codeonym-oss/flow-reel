import { describe, expect, it } from "vitest";
import { compareEffects, compareTranscripts } from "../../src/compare.ts";
import type { EventLog } from "../../src/composer/schema/events.ts";
import type { Transcript } from "../../src/composer/schema/transcript.ts";

const transcript = (): Transcript => ({ version: 2, script: "demo.ts",
  video: { file: "demo.mp4", width: 960, height: 540, fps: 30, durationMs: 4000 },
  voice: { adapter: "qwen", voice: "Ryan", seed: 0, language: "english" },
  steps: [{ index: 0, comment: "Hello", startMs: 500, actionEndMs: 700, endMs: 1700,
    audio: { file: "a/000.wav", durationMs: 1000, sha256: "a".repeat(64) } }],
});
it("accepts 150 ms start drift and relocated paths, rejecting 151 ms", () => {
  const a = transcript(); const b = transcript();
  b.script = "elsewhere.ts"; b.video.file = "elsewhere.mp4"; b.steps[0].audio!.file = "b/000.wav";
  b.steps[0].startMs += 150; b.steps[0].actionEndMs += 150; b.steps[0].endMs += 150;
  expect(compareTranscripts(a, b)).toEqual({ errors: [], differences: [] });
  b.steps[0].startMs++;
  b.steps[0].endMs++;
  expect(compareTranscripts(a, b).differences).toEqual(["steps[0].startMs differs by 151 ms (maximum 150 ms)"]);
});

it("reports comment, voice, clip and video identity changes", () => {
  const a = transcript(); const b = transcript();
  b.video.width = 1280; b.voice!.seed = 1; b.steps[0].comment = "Hi";
  b.steps[0].audio!.sha256 = "b".repeat(64); b.steps[0].audio!.durationMs = 900;
  expect(compareTranscripts(a, b).differences).toEqual([
    "video.width differs", "voice.seed differs", "steps[0].comment differs",
    "steps[0].audio.sha256 differs", "steps[0].audio.durationMs differs",
  ]);
});

it("separates invalid inputs from content differences and preserves silent compatibility", () => {
  expect(compareTranscripts(null, transcript()).errors).toEqual(["left: transcript must be an object"]);
  const a = transcript(); delete a.voice; delete a.steps[0].audio;
  const b = structuredClone(a);
  expect(compareTranscripts(a, b)).toEqual({ errors: [], differences: [] });
  b.steps = [];
  expect(compareTranscripts(a, b).differences).toEqual(["step count differs"]);
  b.steps = [{ ...a.steps[0], index: 1 }];
  expect(compareTranscripts(a, b).errors).toContain("right: steps[0]: index must be 0");
});

describe("compareEffects (GH-32 decision 007)", () => {
  const log = (): EventLog => ({ version: 6, autoZoom: true, events: [
    { t: 100, type: "click", at: [1, 1], button: "left", target: "a" },
    { t: 200, type: "flash", color: "#ffffff", ms: 250 },
    { t: 300, type: "frame", image: "a.png", sha256: "a".repeat(64), durationMs: 1000, fit: "contain", background: "#000000" },
    { t: 1400, type: "zoom", zoom: "in", at: [5, 5], scale: 4 / 3, ms: 650 },
    { t: 2000, type: "zoom", zoom: "out", ms: 800 },
  ] });

  it("matches effects within 150 ms, whatever the clicks, sounds and image paths", () => {
    const a = log(); const b = log();
    b.events = b.events.map((e) => ({ ...e, t: e.t + 150 }));
    b.events[0] = { t: 900, type: "click", at: [500, 500], button: "left", target: "b" };
    b.events.push({ t: 50, type: "sound", name: "open" });
    (b.events[2] as { image: string }).image = "moved/a.png";
    expect(compareEffects(a, b)).toEqual({ errors: [], differences: [] });
    b.events[1].t += 1;
    expect(compareEffects(a, b).differences).toEqual(["effects[0] (flash) starts 151 ms apart (maximum 150 ms)"]);
  });

  it("names each effect that differs, and autoZoom", () => {
    const a = log(); const b = log();
    b.autoZoom = false;
    (b.events[1] as { color: string }).color = "#ff0000";
    (b.events[2] as { sha256: string }).sha256 = "b".repeat(64);
    (b.events[3] as { scale: number }).scale = 2;
    expect(compareEffects(a, b).differences).toEqual(["autoZoom differs",
      "effects[0] (flash) differs", "effects[1] (frame) differs", "effects[2] (zoom) differs"]);
    expect(compareEffects(a, log()).differences).toEqual([]);
    expect(compareEffects(a, { ...log(), events: log().events.slice(0, 4) }).differences).toEqual(["effect count differs (4 and 3)"]);
  });

  it("compares speed-ups by factor and start, not by how long the wait took (GH-61 decision 005)", () => {
    const sped = (factor: number, t: number, durationMs: number): EventLog =>
      ({ version: 6, autoZoom: true, events: [{ t, type: "speed", factor, durationMs }] });
    expect(compareEffects(sped(4, 1000, 15000), sped(4, 1100, 12000)).differences).toEqual([]);
    expect(compareEffects(sped(4, 1000, 15000), sped(2, 1000, 15000)).differences).toEqual(["effects[0] (speed) differs"]);
    expect(compareEffects(sped(4, 1000, 15000), { ...log(), events: [] }).differences).toEqual(["effect count differs (1 and 0)"]);
  });

  it("compares cards by kind, props, look and file hashes (GH-76 decision 001)", () => {
    const card = (t: number, title: string): EventLog => ({ version: 6, autoZoom: true, events: [{ t, type: "card", card: "intro",
      props: { title }, files: [], enter: "fade", exit: "fade", theme: "ink" }] });
    expect(compareEffects(card(1000, "Saved views"), card(1100, "Saved views")).differences).toEqual([]);
    expect(compareEffects(card(1000, "Saved views"), card(1000, "Views")).differences).toEqual(["effects[0] (card) differs"]);
  });

  it("compares skips by label and start, not by how long the wait took (GH-62 decision 004)", () => {
    const cut = (label: string, t: number, durationMs: number): EventLog =>
      ({ version: 6, autoZoom: true, events: [{ t, type: "skip", durationMs, label, style: "clock" }] });
    expect(compareEffects(cut("{duration} skipped", 1000, 38000), cut("{duration} skipped", 1100, 21000)).differences).toEqual([]);
    expect(compareEffects(cut("{duration} skipped", 1000, 38000), cut("later", 1000, 38000)).differences)
      .toEqual(["effects[0] (skip) differs"]);
  });

  it("reports an invalid event log as an error", () => {
    expect(compareEffects({ version: 3, events: [] }, log()).errors).toEqual([
      "left: events.json: version must be 6", "left: events.json: autoZoom must be true or false"]);
  });
});

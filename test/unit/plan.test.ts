import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planReel } from "../../src/composer/phases/plan.ts";
import { reelText } from "../../src/composer/reel.ts";
import { type CueSheet, validateCues } from "../../src/composer/schema/cues.ts";
import { type Plan, validatePlan } from "../../src/composer/schema/plan.ts";
import { readJson } from "../../src/composer/schema/read.ts";
import { type Voiced, validateVoiced } from "../../src/composer/schema/voiced.ts";

const audio = { file: "audio/000.wav", durationMs: 2000, sha256: "a".repeat(64) };
const cues: CueSheet = { version: 1, script: { file: "admin/refund.reel.ts", sha256: "b".repeat(64) }, integration: "playwright",
  platform: "linux/amd64", viewport: [960, 540], fps: 30, autoZoom: true, capture: { file: "capture.mp4", frames: 180, cutMs: 1000 },
  steps: [{ index: 0, comment: "Refund it.", startMs: 500, actionEndMs: 900, endMs: 1200 }, { index: 1, startMs: 1300, actionEndMs: 1500, endMs: 1800 }],
  events: [{ t: 600, type: "click", at: [10, 20], button: "left", target: "button" },
    { t: 1400, type: "card", card: "chapter", props: { title: "One" }, files: [], enter: "fade", exit: "fade", theme: "ink" },
    { t: 1700, type: "card", card: "chapter", props: { title: "Two" }, files: [], ms: 900, enter: "cut", exit: "cut", theme: "paper" }] };
const voiced: Voiced = { version: 1, voice: { adapter: "openai:tts", voice: "nova", seed: 0, language: "auto" }, clips: [{ step: 0, audio }] };

describe("planReel", () => {
  it("is the same plan each time, and holds nothing JSON can't", () => {
    const plan = planReel(cues, voiced, { brand: { accent: "#46d3c8" }, sound: true });
    expect(planReel(cues, voiced, { brand: { accent: "#46d3c8" }, sound: true })).toEqual(plan);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("holds the step until its comment is spoken, and draws the cards the script showed", () => {
    const plan = planReel(cues, voiced, { brand: { accent: "#46d3c8" }, sound: false });
    expect(plan).toMatchObject({ version: 1, viewport: [960, 540], fps: 30, sound: false, log: { version: 6, autoZoom: true } });
    const [first, second] = plan.timeline.steps;
    expect(first).toMatchObject({ audio, startMs: 500 });
    expect(first.endMs - first.startMs).toBeGreaterThanOrEqual(audio.durationMs + 200);
    expect(second.audio).toBeUndefined();
    expect(plan.cards).toMatchObject([
      { id: "card0", kind: "chapter", props: { title: "One" }, chapter: { number: 1, total: 2 }, theme: { accent: "#46d3c8" }, frames: 90 },
      { id: "card1", kind: "chapter", chapter: { number: 2, total: 2 }, frames: 27 }]);
    expect(plan.log.events.map((e) => e.type)).toEqual(["click", "card", "card"]);
  });

  it("makes a reel's text that is in sync, and refuses one that isn't", () => {
    const plan = planReel(cues, voiced, { brand: {}, sound: true });
    const durationMs = (plan.timeline.frames - plan.timeline.cutFrames) * 1000 / 30;
    const text = reelText({ cues, voiced, plan, durationMs, video: "video.mp4", composerVersion: "0.8.0" });
    expect(text.transcript).toMatchObject({ version: 2, script: "admin/refund.reel.ts", voice: voiced.voice,
      video: { file: "video.mp4", width: 960, height: 540, fps: 30, durationMs } });
    expect(text.about).toEqual({ script: cues.script, composer: { version: "0.8.0", platform: "linux/amd64" }, integration: "playwright", voice: voiced.voice });
    expect(text.captions.vtt).toContain("Refund it.");
    expect(() => reelText({ cues, voiced, plan, durationMs: 1000, video: "video.mp4", composerVersion: "0.8.0" })).toThrow("recording is invalid");
  });
});

describe("the files between phases", () => {
  it("are read back as they were written, and say what is wrong with them otherwise", () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-plan-"));
    try {
      const file = join(dir, "cues.json");
      const read = (value: unknown) => { writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return () => readJson<CueSheet>(file, validateCues); };
      expect(read(cues)()).toEqual(cues);
      expect(read("{")).toThrow("cues.json can't be read");
      expect(read({ ...cues, version: 2 })).toThrow("cues.json is invalid:\n  version must be 1");
      expect(read({ ...cues, viewport: [960] })).toThrow("viewport must be");
      expect(read({ ...cues, steps: [{ ...cues.steps[0], endMs: 0 }] })).toThrow("steps[0]: endMs must be >= actionEndMs");
      expect(read({ ...cues, capture: {} })).toThrow("capture.file must be a string");
    } finally { rmSync(dir, { recursive: true, force: true }); }
    expect(validateVoiced(voiced)).toEqual([]);
    expect(validateVoiced({ ...voiced, clips: [{ step: -1, audio: {} }] })).toContain("clips[0]: step must be a number >= 0");
    expect(validatePlan(planReel(cues, voiced, { brand: {}, sound: true }) satisfies Plan)).toEqual([]);
    expect(validatePlan({ version: 2 })).toEqual(["version must be 1"]);
  });
});

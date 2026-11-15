import { expect, it } from "vitest";
import { validateSync } from "../../src/composer/schema/sync.ts";
import type { Transcript } from "../../src/composer/schema/transcript.ts";

export const voiced = (): Transcript => ({ version: 2, script: "demo.ts",
  video: { file: "demo.mp4", width: 960, height: 540, fps: 30, durationMs: 3000 },
  voice: { adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0, language: "english" },
  steps: [{ index: 0, comment: "Hello", startMs: 500, actionEndMs: 700, endMs: 1700,
    audio: { file: "demo.audio/000.wav", durationMs: 1000, sha256: "a".repeat(64) } }],
});

it("accepts fitted comment and rejects speech without its 200 ms tail", () => {
  const t = voiced();
  expect(validateSync(t)).toEqual([]);
  t.steps[0].endMs = 1699;
  expect(validateSync(t)).toContain("steps[0]: audio needs its full duration plus 200 ms tail");
});

it("rejects missing voiced clips, unusable hashes, overlaps and out-of-video windows", () => {
  const missing = voiced();
  delete missing.steps[0].audio;
  expect(validateSync(missing)).toContain("steps[0]: nonblank comment needs audio when voice is configured");
  const malformed = voiced();
  malformed.steps[0].audio!.sha256 = "bad";
  expect(validateSync(malformed)).toContain("steps[0]: audio.sha256 must be a SHA-256 hex digest");
  const overlap = voiced();
  overlap.steps.push({ index: 1, startMs: 1600, actionEndMs: 1800, endMs: 3100 });
  expect(validateSync(overlap)).toContain("steps[1]: window overlaps the previous step");
  expect(validateSync(overlap)).toContain("steps[1]: endMs exceeds video durationMs");
});

it("keeps legacy silent and blank-only transcripts valid, but rejects invalid dimensions and ordering", () => {
  const t = voiced();
  delete t.voice;
  delete t.steps[0].audio;
  expect(validateSync(t)).toEqual([]);
  t.voice = { adapter: "qwen", voice: "Ryan", seed: 0, language: "english" };
  t.steps[0].comment = " \n ";
  expect(validateSync(t)).toEqual([]);
  t.video.fps = 0;
  expect(validateSync(t)).toContain("video.fps must be positive");
  t.steps[0].actionEndMs = 400;
  expect(validateSync(t)).toContain("steps[0]: actionEndMs must be >= startMs");
  expect(validateSync(null)).toEqual(["transcript must be an object"]);
});

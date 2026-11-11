import { expect, it } from "vitest";
import { compareTranscripts } from "../../src/compare.ts";
import type { Transcript } from "../../src/schema/transcript.ts";

const transcript = (): Transcript => ({ version: 1, script: "demo.ts",
  video: { file: "demo.mp4", width: 960, height: 540, fps: 30, durationMs: 4000 },
  voice: { adapter: "qwen", voice: "Ryan", seed: 0 },
  steps: [{ index: 0, narration: "Hello", startMs: 500, actionEndMs: 700, endMs: 1700,
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

it("reports narration, voice, clip and video identity changes", () => {
  const a = transcript(); const b = transcript();
  b.video.width = 1280; b.voice!.seed = 1; b.steps[0].narration = "Hi";
  b.steps[0].audio!.sha256 = "b".repeat(64); b.steps[0].audio!.durationMs = 900;
  expect(compareTranscripts(a, b).differences).toEqual([
    "video.width differs", "voice.seed differs", "steps[0].narration differs",
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

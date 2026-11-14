import { describe, expect, it } from "vitest";
import { validateEvents } from "../../src/composer/schema/events.ts";
import { validateTranscript } from "../../src/composer/schema/transcript.ts";

// The examples of story decisions 011 and 013, verbatim.
const transcript = {
  version: 2,
  script: "demo.ts",
  video: { file: "demo.mp4", width: 1920, height: 1080, fps: 30, durationMs: 14820 },
  voice: { adapter: "kokoro", voice: "af_heart", seed: 0 },
  steps: [
    {
      index: 0, comment: "Open the settings page.",
      startMs: 0, actionEndMs: 820, endMs: 2410,
      audio: { file: "audio/000.wav", durationMs: 2310, sha256: "…" },
    },
  ],
};

const events = {
  version: 3,
  events: [
    { t: 1200, type: "move", from: [960, 540], to: [1412, 288], durationMs: 450, easing: "easeInOutCubic" },
    { t: 1650, type: "click", at: [1412, 288], button: "left", target: 'link "Settings"' },
    { t: 2400, type: "type", text: "hello", charDelayMs: 60, target: 'textbox "Name"' },
    { t: 3100, type: "scroll", delta: [0, 600], durationMs: 400 },
  ],
};

describe("validateTranscript", () => {
  it("accepts the decision 011 example", () => {
    expect(validateTranscript(transcript)).toEqual([]);
  });

  it("accepts what GH-2 writes: no voice, no comment, no audio", () => {
    expect(validateTranscript({
      version: 2, script: "demo.ts",
      video: { file: "demo.mp4", width: 1920, height: 1080, fps: 30, durationMs: 900 },
      steps: [{ index: 0, startMs: 0, actionEndMs: 820, endMs: 820 }],
    })).toEqual([]);
  });

  it("rejects a version-1 transcript, which named comments narration", () => {
    expect(validateTranscript({ ...transcript, version: 1 })).toContain("version must be 2");
  });

  it("rejects a missing version", () => {
    const { version: _, ...rest } = transcript;
    expect(validateTranscript(rest)).toContain("version must be 2");
  });

  it("rejects non-string comment while accepting original whitespace", () => {
    expect(validateTranscript({ ...transcript, steps: [{ ...transcript.steps[0], comment: 42 }] }))
      .toContain("steps[0]: comment must be a string");
    expect(validateTranscript({ ...transcript, steps: [{ ...transcript.steps[0], comment: " \r\n\t " }] }))
      .toEqual([]);
  });

  it("rejects a step that ends before it starts", () => {
    const bad = { ...transcript, steps: [{ ...transcript.steps[0], startMs: 500, actionEndMs: 400, endMs: 400 }] };
    expect(validateTranscript(bad)).toContain("steps[0]: actionEndMs must be >= startMs");
  });
});

describe("validateEvents", () => {
  it("accepts optional off-screen bounds and rejects malformed target bounds", () => {
    const log = (bounds: unknown) => ({ version: 3, events: [{ ...events.events[1], bounds }] });
    expect(validateEvents(log({ x: -10, y: 20, width: 100, height: 30 }))).toEqual([]);
    for (const bounds of [null, {}, { x: 0, y: 0, width: 0, height: 10 },
      { x: NaN, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: -1 }]) {
      expect(validateEvents(log(bounds))).not.toEqual([]);
    }
  });
  it("accepts the decision 013 example", () => {
    expect(validateEvents(events)).toEqual([]);
  });

  it("rejects a negative t", () => {
    const bad = { version: 3, events: [{ ...events.events[1], t: -5 }] };
    expect(validateEvents(bad)).toContain("events[0]: t must be a number >= 0");
  });

  it("accepts only version 3, which names sounds `sound`", () => {
    for (const version of [1, 2]) expect(validateEvents({ ...events, version })).toContain("version must be 3");
    expect(validateEvents({ version: 3, events: [{ t: 0, type: "sfx", name: "success" }] }))
      .toContain('events[0]: unknown type "sfx"');
  });

  it("rejects an unknown event type", () => {
    const bad = { version: 3, events: [{ t: 0, type: "teleport" }] };
    expect(validateEvents(bad)).toContain('events[0]: unknown type "teleport"');
  });
});

import { describe, expect, it } from "vitest";
import { validateEvents } from "../../src/composer/schema/events.ts";
import { validateTranscript } from "../../src/composer/schema/transcript.ts";
import { validateManifest } from "../../src/composer/schema/manifest.ts";

// The examples of story decisions 011 and 013, verbatim.
const transcript = {
  version: 2,
  script: "demo.ts",
  video: { file: "demo.mp4", width: 1920, height: 1080, fps: 30, durationMs: 14820 },
  voice: { adapter: "kokoro", voice: "af_heart", seed: 0, language: "english" },
  steps: [
    {
      index: 0, comment: "Open the settings page.",
      startMs: 0, actionEndMs: 820, endMs: 2410,
      audio: { file: "audio/000.wav", durationMs: 2310, sha256: "…" },
    },
  ],
};

const events = {
  version: 4,
  autoZoom: true,
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
    const log = (bounds: unknown) => ({ version: 4, autoZoom: true, events: [{ ...events.events[1], bounds }] });
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
    const bad = { ...events, events: [{ ...events.events[1], t: -5 }] };
    expect(validateEvents(bad)).toContain("events[0]: t must be a number >= 0");
  });

  it("accepts only version 4, which names sounds `sound` and says whether zoom is automatic", () => {
    for (const version of [1, 2, 3]) expect(validateEvents({ ...events, version })).toContain("version must be 4");
    expect(validateEvents({ ...events, events: [{ t: 0, type: "sfx", name: "success" }] }))
      .toContain('events[0]: unknown type "sfx"');
    const { autoZoom: _, ...noAutoZoom } = events;
    expect(validateEvents(noAutoZoom)).toContain("autoZoom must be true or false");
  });

  it("accepts the effect events of GH-32 decision 005", () => {
    expect(validateEvents({ version: 4, autoZoom: false, events: [
      { t: 1200, type: "flash", color: "#FFFFFF", ms: 250 },
      { t: 1800, type: "frame", image: "img/diagram.png", sha256: "a".repeat(64), durationMs: 3000, fit: "contain", background: "#000000" },
      { t: 5000, type: "zoom", zoom: "in", at: [960, 540], bounds: { x: 900, y: 500, width: 120, height: 80 }, scale: 4 / 3, ms: 650 },
      { t: 5100, type: "zoom", zoom: "in", at: [960, 540], scale: 2, ms: 650 },
      { t: 9000, type: "zoom", zoom: "out", ms: 800 },
    ] })).toEqual([]);
  });

  it("names each malformed effect field", () => {
    const one = (event: object) => validateEvents({ ...events, events: [{ t: 0, ...event }] });
    expect(one({ type: "flash", color: "white", ms: 0 })).toEqual([
      "events[0]: color must be a #rrggbb colour", "events[0]: ms must be a number > 0"]);
    for (const image of ["/abs.png", "../up.png", "a/./b.png", ""]) {
      expect(one({ type: "frame", image, sha256: "a".repeat(64), durationMs: 1, fit: "contain", background: "#000000" }))
        .toEqual(["events[0]: image must be a path relative to the script's folder, without . or .."]);
    }
    expect(one({ type: "frame", image: "a.png", sha256: "x", durationMs: -1, fit: "stretch", background: "#000" })).toEqual([
      "events[0]: sha256 must be a SHA-256 hex digest", "events[0]: durationMs must be a number > 0",
      'events[0]: fit must be "contain" or "cover"', "events[0]: background must be a #rrggbb colour"]);
    expect(one({ type: "zoom", zoom: "in", at: [0, 0], scale: 2.5, ms: 650 })).toEqual(["events[0]: scale must be from 1 to 2"]);
    expect(one({ type: "zoom", zoom: "sideways", ms: 650 })).toEqual(['events[0]: zoom must be "in" or "out"']);
  });

  it("rejects an unknown event type", () => {
    const bad = { ...events, events: [{ t: 0, type: "teleport" }] };
    expect(validateEvents(bad)).toContain('events[0]: unknown type "teleport"');
  });
});

describe("validateManifest", () => {
  const file = (path: string) => ({ path, bytes: 4, sha256: "b".repeat(64) });
  const manifest = {
    version: 1, script: { file: "settings.ts", sha256: "a".repeat(64) },
    composer: { version: "0.2.0", platform: "linux/amd64" }, integration: "playwright",
    voice: { adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0, language: "english" },
    files: [file("audio/000.wav"), file("transcript.json"), file("video.mp4")],
  };

  it("accepts the decision 003 example, with or without a voice", () => {
    expect(validateManifest(manifest)).toEqual([]);
    const { voice: _, ...silent } = manifest;
    expect(validateManifest(silent)).toEqual([]);
  });

  it("names what is wrong", () => {
    expect(validateManifest({ ...manifest, version: 2 })).toContain("version must be 1");
    expect(validateManifest({ ...manifest, script: { file: "x.ts", sha256: "bad" } })).toContain("script.sha256 must be a SHA-256 hex digest");
    expect(validateManifest({ ...manifest, files: [] })).toContain("files must be a nonempty array");
    expect(validateManifest({ ...manifest, files: [file("b"), file("a")] })).toContain("files[1]: paths must be sorted and unique");
    expect(validateManifest({ ...manifest, files: [file("a"), file("a")] })).toContain("files[1]: paths must be sorted and unique");
    for (const path of ["../x", "/etc/passwd", "a//b", "./a"]) {
      expect(validateManifest({ ...manifest, files: [file(path)] })).toContain("files[0]: path must be relative to the reel, without . or ..");
    }
    expect(validateManifest({ ...manifest, files: [file("work/capture.mp4")] })).toContain("files[0]: work/capture.mp4 must not be listed");
    expect(validateManifest({ ...manifest, files: [file("manifest.json")] })).toContain("files[0]: manifest.json must not be listed");
  });
});

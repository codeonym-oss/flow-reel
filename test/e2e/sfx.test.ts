import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { assembleSfx } from "../../src/runner/sfx-audio.ts";
import { planTimeline } from "../../src/runner/timeline.ts";
import { renderTimeline, videoFrames, measureLoudness } from "../../src/runner/render.ts";
import { SFX_NAMES, type RunnerEvent } from "../../src/schema/events.ts";

const dir = resolve("test/e2e/out/sfx");
mkdirSync(dir, { recursive: true });
const timeline = planTimeline([], { fps: 30, frames: 90, cutMs: 0 });
const decode = (file: string) => execFileSync("ffmpeg", ["-v", "error", "-i", file, "-af", "pan=mono|c0=c0", "-f", "f32le", "-"], { maxBuffer: 8 << 20 });

it("renders quiet, sample-timed effects without voice, with exact duration and repeatable PCM", () => {
  const events = [{ t: 500, type: "sfx" as const, name: "success" as const }];
  const file = assembleSfx(events, timeline, undefined, dir)!;
  const raw = decode(file);
  expect(raw.length).toBe(144000 * 4);
  expect(raw.subarray(0, 24000 * 4).every((v) => v === 0)).toBe(true);
  let peak = 0, first = -1;
  for (let i = 0; i < raw.length / 4; i++) {
    const value = Math.abs(raw.readFloatLE(i * 4));
    peak = Math.max(peak, value);
    if (value > 0.00001 && first < 0) first = i;
  }
  expect(first).toBeGreaterThanOrEqual(24000);
  expect(first).toBeLessThan(24048);
  expect(peak).toBeGreaterThan(0.001);
  expect(peak).toBeLessThanOrEqual(10 ** (-18 / 20) + 1e-7);
  assembleSfx(events, timeline, undefined, dir);
  expect(decode(file)).toEqual(raw);
  expect(readFileSync(file).length).toBeGreaterThan(raw.length);
});

it("ducks effects over whole narration clips with 30 ms attack and 250 ms recovery", () => {
  const voice = join(dir, "reference.wav");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", voice]);
  const events: RunnerEvent[] = [{ t: 900, type: "sfx", name: "notification" }, { t: 1950, type: "sfx", name: "notification" }];
  assembleSfx(events, timeline, voice, dir);
  const baseline = decode(join(dir, "sfx.wav"));
  const withSpeech = { ...timeline, steps: [{ index: 0, startMs: 1000, actionEndMs: 1100, endMs: 2200,
    audio: { file: "reference.wav", durationMs: 1000, sha256: "a".repeat(64) } }] };
  assembleSfx(events, withSpeech, voice, dir);
  const ducked = decode(join(dir, "sfx.wav"));
  const ratio = (ms: number) => {
    let n = Math.round(ms * 48);
    while (Math.abs(baseline.readFloatLE(n * 4)) < 0.00001) n++;
    return ducked.readFloatLE(n * 4) / baseline.readFloatLE(n * 4);
  };
  expect(ratio(950)).toBeCloseTo(1, 3);
  expect(ratio(985)).toBeCloseTo(10 ** (-3 / 20), 2);
  expect(ratio(1010)).toBeCloseTo(10 ** (-6 / 20), 3);
  expect(ratio(2125)).toBeCloseTo(10 ** (-3 / 20), 2);
  expect(ratio(2260)).toBeCloseTo(1, 3);
  assembleSfx(events, { ...withSpeech, steps: [...withSpeech.steps,
    { ...withSpeech.steps[0], index: 1, startMs: 2100 }] }, voice, dir);
  const overlapping = decode(join(dir, "sfx.wav"));
  let n = 2125 * 48;
  while (Math.abs(baseline.readFloatLE(n * 4)) < 0.00001) n++;
  expect(overlapping.readFloatLE(n * 4) / baseline.readFloatLE(n * 4)).toBeCloseTo(10 ** (-6 / 20), 3);
  expect(assembleSfx(events, withSpeech, voice, dir, false)).toBeUndefined();
  expect(existsSync(join(dir, "sfx.wav"))).toBe(false);
  expect(existsSync(join(dir, "mix.bus.wav"))).toBe(false);
});

it("handles long typing and simultaneous cues with bounded peaks and exact tail trimming", () => {
  const long = planTimeline([], { fps: 30, frames: 960, cutMs: 0 });
  const events: RunnerEvent[] = [{ t: 100, type: "type", text: "abc".repeat(175), charDelayMs: 60, target: "field" },
    ...SFX_NAMES.flatMap((name) => Array.from({ length: 10 }, (): RunnerEvent => ({ t: 16000, type: "sfx", name }))),
    { t: 31990, type: "sfx", name: "success" }];
  const file = assembleSfx(events, long, undefined, dir)!;
  const raw = decode(file);
  expect(raw.length).toBe(1536000 * 4);
  let peak = 0;
  for (let i = 0; i < raw.length; i += 4) peak = Math.max(peak, Math.abs(raw.readFloatLE(i)));
  expect(peak).toBeLessThanOrEqual(10 ** (-18 / 20) + 1e-7);
  expect(peak).toBeGreaterThan(0.001);
  expect(raw.readFloatLE(raw.length - 4)).toBe(0);
  const tap = (ms: number) => raw.subarray(ms * 48 * 4, (ms + 40) * 48 * 4);
  expect(tap(100)).not.toEqual(tap(160));
  expect(tap(100)).toEqual(tap(280));
  expect(tap(160)).not.toEqual(tap(220));
});

it("muxes all named cues and automatic typing, preserves frames, and fully mutes on rerender", () => {
  const capture = join(dir, "capture.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=black:s=160x90:r=30:d=3", "-c:v", "libx264", capture]);
  const options = { capture, master: join(dir, "master.mp4"), video: join(dir, "demo.mp4"), voice: join(dir, "voice.wav"),
    audioDir: dir, viewport: [160, 90] as [number, number], timeline,
    events: SFX_NAMES.map((name, i): RunnerEvent => ({ t: 100 + i * 300, type: "sfx", name })) };
  options.events.push({ t: 2500, type: "type", text: "Ada", charDelayMs: 60, target: "field" });
  renderTimeline(options);
  expect(videoFrames(options.video)).toBe(90);
  expect(Number(measureLoudness(options.video).input_tp)).toBeLessThan(-17);
  expect(decode(options.video).some((v) => v !== 0)).toBe(true);
  renderTimeline({ ...options, sfx: false });
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", options.video], { encoding: "utf8" }));
  expect(probe.streams.map((s: { codec_type: string }) => s.codec_type)).toEqual(["video"]);
  expect(existsSync(join(dir, "sfx.wav"))).toBe(false);
  expect(videoFrames(options.video)).toBe(90);
  expect(() => renderTimeline({ ...options, events: [{ t: 2999.9, type: "sfx", name: "error" }] })).not.toThrow();
});

it("calibrates cue and typing RMS separately and keeps their level independent of silent padding", () => {
  const level = (raw: Buffer) => {
    let first = 0, last = raw.length / 4 - 1;
    while (Math.abs(raw.readFloatLE(first * 4)) < 1e-8) first++;
    while (Math.abs(raw.readFloatLE(last * 4)) < 1e-8) last--;
    let energy = 0;
    for (let i = first; i <= last; i++) energy += raw.readFloatLE(i * 4) ** 2;
    return 10 * Math.log10(energy / (last - first + 1));
  };
  const cue: RunnerEvent[] = [{ t: 500, type: "sfx", name: "notification" }];
  const file = assembleSfx(cue, timeline, undefined, dir)!;
  const normal = decode(file);
  expect(level(normal)).toBeCloseTo(-32, 0);
  assembleSfx(cue, planTimeline([], { fps: 30, frames: 180, cutMs: 0 }), undefined, dir);
  expect(decode(file).subarray(0, normal.length)).toEqual(normal);
  assembleSfx([{ t: 500, type: "type", text: "a", charDelayMs: 60, target: "field" }], timeline, undefined, dir);
  expect(level(decode(file))).toBeCloseTo(-38, 0);
  const voice = join(dir, "calibration.wav");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3", voice]);
  const voiced = { ...timeline, steps: [{ index: 0, startMs: 0, actionEndMs: 100, endMs: 3000,
    audio: { file: "calibration.wav", durationMs: 3000, sha256: "a".repeat(64) } }] };
  // FFmpeg's sine source peaks at 1/8: -21.07 dBFS RMS. Cue is 12 dB below, then ducks 6 dB.
  assembleSfx(cue, voiced, voice, dir);
  expect(level(decode(file))).toBeCloseTo(-39.07, 0);
  assembleSfx([{ t: 500, type: "type", text: "a", charDelayMs: 60, target: "field" }], voiced, voice, dir);
  expect(level(decode(file))).toBeCloseTo(-45.07, 0);
});

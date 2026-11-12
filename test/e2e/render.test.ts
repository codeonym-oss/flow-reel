import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { beforeAll, expect, it } from "vitest";
import { planTimeline } from "../../src/runner/timeline.ts";
import { renderTimeline, videoFrames } from "../../src/runner/render.ts";

const dir = resolve("test/e2e/out/render");
const media = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
beforeAll(() => {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  media(["-f", "lavfi", "-i", "color=red:s=160x90:r=30:d=1", "-f", "lavfi", "-i", "color=blue:s=160x90:r=30:d=1",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", join(dir, "capture.mp4")]);
  media(["-f", "lavfi", "-i", "color=red:s=160x90:r=30:d=6", "-c:v", "libx264", join(dir, "audio-capture.mp4")]);
  for (const [name, frequency, duration] of [["one", 440, 0.7], ["two", 880, 0.6]] as const) {
    media(["-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=24000:duration=${duration}`,
      "-c:a", "pcm_s16le", join(dir, `${name}.wav`)]);
  }
});
const options = (name: string) => ({ capture: join(dir, "capture.mp4"), master: join(dir, `${name}-master.mp4`),
  video: join(dir, `${name}.mp4`), voice: join(dir, `${name}-voice.wav`), audioDir: dir, viewport: [160, 90] as [number, number] });

it("preserves calibration pre-roll and exact frames in a silent no-hold delivery", () => {
  const timeline = planTimeline([], { fps: 30, frames: 60, cutMs: 500 });
  const out = options("silent");
  renderTimeline({ ...out, timeline });
  expect(videoFrames(out.master)).toBe(60);
  expect(videoFrames(out.video)).toBe(45);
  const { streams } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", out.video], { encoding: "utf8" }));
  expect(streams.map((s: { codec_type: string }) => s.codec_type)).toEqual(["video"]);
});

it("clones the last captured frame at multiple boundaries including the final frame", () => {
  const timeline = planTimeline([
    { index: 0, narration: "red", startMs: 0, actionEndMs: 200, endMs: 500,
      audio: { file: "unused.wav", durationMs: 800, sha256: "a".repeat(64) } },
    { index: 1, narration: "blue", startMs: 1200, actionEndMs: 1300, endMs: 1500,
      audio: { file: "unused.wav", durationMs: 600, sha256: "a".repeat(64) } },
  ], { fps: 30, frames: 60, cutMs: 500 });
  const out = options("held");
  // This slice tests video holds; audio placement is covered separately below.
  timeline.steps = timeline.steps.map(({ audio: _, ...s }) => s);
  renderTimeline({ ...out, timeline });
  expect(videoFrames(out.master)).toBe(90);
  expect(videoFrames(out.video)).toBe(75);
  const pixels = execFileSync("ffmpeg", ["-v", "error", "-i", out.video, "-vf", "scale=1:1,format=rgb24", "-f", "rawvideo", "-"]);
  const pixel = (frame: number) => [...pixels.subarray(frame * 3, frame * 3 + 3)];
  expect(pixel(29)[0]).toBeGreaterThan(200);
  expect(pixel(30)[2]).toBeGreaterThan(200);
  expect(pixel(74)[2]).toBeGreaterThan(200);
});

it("places original clips on the delivery clock and normalizes decoded AAC without changing source WAVs", async () => {
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
  const hashes = [hash(join(dir, "one.wav")), hash(join(dir, "two.wav"))];
  const timeline = planTimeline([
    { index: 0, narration: "one", startMs: 500, actionEndMs: 600, endMs: 1500,
      audio: { file: "one.wav", durationMs: 700, sha256: hashes[0] } },
    { index: 1, narration: "two", startMs: 3000, actionEndMs: 3200, endMs: 4000,
      audio: { file: "two.wav", durationMs: 600, sha256: hashes[1] } },
  ], { fps: 30, frames: 180, cutMs: 500 });
  const out = { ...options("audio"), capture: join(dir, "audio-capture.mp4") };
  renderTimeline({ ...out, timeline });
  const { streams } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", out.video], { encoding: "utf8" }));
  expect(streams.find((s: { codec_type: string }) => s.codec_type === "audio"))
    .toMatchObject({ codec_name: "aac", profile: "LC", sample_rate: "48000", channels: 2 });
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", out.video, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 4 << 20 });
  const active: number[] = [];
  for (let at = 0; at + 480 * 4 <= raw.length; at += 480 * 4) {
    let energy = 0;
    for (let i = 0; i < 480; i++) energy += raw.readFloatLE(at + i * 4) ** 2;
    if (Math.sqrt(energy / 480) > 0.01) active.push(at / 4 / 48);
  }
  const groups = active.filter((t, i) => i === 0 || t - active[i - 1] > 20);
  const ends = active.filter((t, i) => i === active.length - 1 || active[i + 1] - t > 20).map((t) => t + 10);
  expect(groups).toHaveLength(2);
  expect(Math.abs(groups[0] - 500)).toBeLessThanOrEqual(1000 / 30);
  expect(Math.abs(ends[0] - 1200)).toBeLessThanOrEqual(1000 / 30);
  expect(Math.abs(groups[1] - 3000)).toBeLessThanOrEqual(1000 / 30);
  expect(Math.abs(ends[1] - 3600)).toBeLessThanOrEqual(1000 / 30);
  const { measureLoudness } = await import("../../src/runner/render.ts");
  const measured = measureLoudness(out.video);
  expect(Math.abs(Number(measured.input_i) + 16)).toBeLessThanOrEqual(1);
  expect(Number(measured.input_tp)).toBeLessThanOrEqual(-1.4);
  expect([hash(join(dir, "one.wav")), hash(join(dir, "two.wav"))]).toEqual(hashes);
});

it("rejects missing media and nonempty clips containing only silence", () => {
  const timeline = planTimeline([], { fps: 30, frames: 60, cutMs: 500 });
  expect(() => renderTimeline({ ...options("broken"), capture: join(dir, "missing.mp4"), timeline })).toThrow();
  media(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "1", "-c:a", "pcm_s16le", join(dir, "silence.wav")]);
  const silentClip = planTimeline([{ index: 0, narration: "voice", startMs: 0, actionEndMs: 100, endMs: 1500,
    audio: { file: "silence.wav", durationMs: 1000, sha256: "a".repeat(64) } }], { fps: 30, frames: 60, cutMs: 500 });
  expect(() => renderTimeline({ ...options("silent-clip"), timeline: silentClip })).toThrow(/no measurable audio/);
});

it("clears generated voice intermediates when a voiced demo is rerendered with blank narration", async () => {
  const { existsSync, writeFileSync } = await import("node:fs");
  const out = options("blank-rerun");
  writeFileSync(out.voice, "previous voice"); writeFileSync(out.voice + ".bus.wav", "previous bus");
  renderTimeline({ ...out, timeline: planTimeline([], { fps: 30, frames: 60, cutMs: 500 }) });
  expect(existsSync(out.voice)).toBe(false);
  expect(existsSync(out.voice + ".bus.wav")).toBe(false);
});

it("keeps the full voice duration when normalization falls back to dynamic mode", () => {
  media(["-f", "lavfi", "-i", "aevalsrc=0.002*sin(2*PI*440*t)+if(lt(mod(t\\,0.2)\\,0.0001)\\,0.9\\,0):s=24000:d=1",
    "-c:a", "pcm_s16le", join(dir, "transient.wav")]);
  const timeline = planTimeline([
    { index: 0, narration: "transient", startMs: 500, actionEndMs: 600, endMs: 1700,
      audio: { file: "transient.wav", durationMs: 1000, sha256: "a".repeat(64) } },
    { index: 1, narration: "late", startMs: 3000, actionEndMs: 3100, endMs: 4000,
      audio: { file: "two.wav", durationMs: 600, sha256: "b".repeat(64) } },
  ], { fps: 30, frames: 180, cutMs: 500 });
  const out = { ...options("dynamic"), capture: join(dir, "audio-capture.mp4") };
  // This deliberately extreme crest factor misses the loudness target and is rejected. Even on
  // that path the normalized bus must retain its full duration and late clip, without sample-rate truncation.
  expect(() => renderTimeline({ ...out, timeline })).toThrow(/loudness target/);
  const { streams: [audio] } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", out.voice], { encoding: "utf8" }));
  expect(Number(audio.duration)).toBe(5.5);
  const late = execFileSync("ffmpeg", ["-v", "error", "-ss", "3.1", "-i", out.voice, "-t", "0.1", "-ac", "1", "-f", "f32le", "-"]);
  let energy = 0;
  for (let i = 0; i < late.length; i += 4) energy += late.readFloatLE(i) ** 2;
  expect(Math.sqrt(energy / (late.length / 4))).toBeGreaterThan(0.01);
});

it("places a later clip after prior holds while preserving the final speech tail", () => {
  const timeline = planTimeline([
    { index: 0, narration: "one", startMs: 0, actionEndMs: 100, endMs: 300,
      audio: { file: "one.wav", durationMs: 700, sha256: "a".repeat(64) } },
    { index: 1, narration: "two", startMs: 1200, actionEndMs: 1300, endMs: 1500,
      audio: { file: "two.wav", durationMs: 600, sha256: "b".repeat(64) } },
  ], { fps: 30, frames: 60, cutMs: 500 });
  const out = options("held-audio");
  renderTimeline({ ...out, timeline, sfx: false, events: [
    { t: 100, type: "click", at: [80, 45], button: "left", target: "one" },
    { t: 1900, type: "click", at: [120, 60], button: "left", target: "two" },
  ] });
  expect(videoFrames(out.master)).toBe(93);
  expect(videoFrames(out.video)).toBe(78);
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", out.video, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
    { maxBuffer: 4 << 20 });
  const active: number[] = [];
  for (let at = 0; at + 480 * 4 <= raw.length; at += 480 * 4) {
    let energy = 0;
    for (let i = 0; i < 480; i++) energy += raw.readFloatLE(at + i * 4) ** 2;
    if (Math.sqrt(energy / 480) > 0.01) active.push(at / 4 / 48);
  }
  const starts = active.filter((t, i) => i === 0 || t - active[i - 1] > 20);
  const ends = active.filter((t, i) => i === active.length - 1 || active[i + 1] - t > 20).map((t) => t + 10);
  expect(starts).toHaveLength(2);
  expect(Math.abs(starts[1] - 1800)).toBeLessThanOrEqual(1000 / 30);
  expect(Math.abs(ends[1] - 2400)).toBeLessThanOrEqual(1000 / 30);
  expect(raw.length / 4 / 48).toBeGreaterThanOrEqual(2600);
});

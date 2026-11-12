import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { renderTimeline } from "../../src/runner/render.ts";
import { planTimeline } from "../../src/runner/timeline.ts";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { RunnerEvent } from "../../src/schema/events.ts";

it("shows a ripple on its first delivery frame despite fractional timestamp rounding", () => {
  const dir = resolve("test/e2e/out/polish-boundary");
  mkdirSync(dir, { recursive: true });
  const capture = join(dir, "capture.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=black:s=320x180:r=30:d=10", "-c:v", "libx264", capture]);
  const video = join(dir, "demo.mp4");
  renderTimeline({ capture, master: join(dir, "master.mp4"), video, voice: join(dir, "voice.wav"), audioDir: dir,
    viewport: [320, 180], timeline: planTimeline([], { fps: 30, frames: 300, cutMs: 0 }), sfx: false,
    events: [{ t: 8766.419892333333, type: "click", at: [160, 90], button: "left", target: "center" }] });
  const pixels = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", "select=eq(n\\,263),crop=64:64:128:58",
    "-frames:v", "1", "-pix_fmt", "rgb24", "-an", "-fps_mode", "passthrough", "-f", "rawvideo", "-"]);
  let blue = 0;
  for (let i = 0; i < pixels.length; i += 3) if (pixels[i + 2] > 120 && pixels[i + 2] > pixels[i] * 1.4 && pixels[i + 2] > pixels[i + 1] * 1.2) blue++;
  expect(blue).toBeGreaterThan(10);
});

const dir = resolve("test/e2e/out/polish");
const media = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { maxBuffer: 64 << 20 });
it("draws the stationary outlined cursor after trimming pre-roll and keeps the clean master", () => {
  mkdirSync(dir, { recursive: true });
  const capture = join(dir, "capture.mp4");
  media(["-f", "lavfi", "-i", "color=red:s=320x180:r=30:d=1", "-c:v", "libx264", capture]);
  const out = { capture, master: join(dir, "master.mp4"), video: join(dir, "cursor.mp4"),
    voice: join(dir, "voice.wav"), audioDir: dir, viewport: [320, 180] as [number, number],
    timeline: planTimeline([], { fps: 30, frames: 30, cutMs: 100 }) };
  renderTimeline(out);
  const pixels = media(["-i", out.video, "-frames:v", "1", "-pix_fmt", "rgb24", "-an", "-fps_mode", "passthrough", "-f", "rawvideo", "-"]);
  const at = ((90 + 7) * 320 + 160 + 3) * 3;
  expect([...pixels.subarray(at, at + 3)].every((v) => v > 180)).toBe(true);
  expect(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
    "stream=nb_read_frames", "-of", "csv=p=0", out.video], { encoding: "utf8" }).trim()).toBe("27");
});

it("zooms a known grid, follows movement, draws a timely fading ripple and repeats decoded frames", () => {
  mkdirSync(dir, { recursive: true });
  const capture = join(dir, "grid.mp4");
  media(["-f", "lavfi", "-i", "color=black:s=640x360:r=30:d=3,drawbox=x=270:y=150:w=100:h=60:color=red:t=fill", "-c:v", "libx264", capture]);
  const events: RunnerEvent[] = [
    { t: 0, type: "move", from: [100, 90], to: [160, 90], durationMs: 400, easing: "easeInOutCubic" },
    { t: 500.1, type: "click", at: [160, 90], button: "left", target: "red", bounds: { x: 135, y: 75, width: 50, height: 30 } }];
  const timeline = planTimeline([], { fps: 30, frames: 90, cutMs: 100 });
  const out = { capture, master: join(dir, "grid-master.mp4"), video: join(dir, "grid-a.mp4"),
    voice: join(dir, "grid-voice.wav"), audioDir: dir, viewport: [320, 180] as [number, number], timeline, events };
  renderTimeline(out);
  const before = createHash("sha256").update(readFileSync(out.master)).digest("hex");
  renderTimeline({ ...out, video: join(dir, "grid-b.mp4") });
  const decode = (file: string) => media(["-i", file, "-pix_fmt", "rgb24", "-an", "-fps_mode", "passthrough", "-f", "rawvideo", "-"]);
  const raw = decode(out.video);
  expect(createHash("sha256").update(raw).digest("hex")).toBe(createHash("sha256").update(decode(join(dir, "grid-b.mp4"))).digest("hex"));
  expect(createHash("sha256").update(readFileSync(out.master)).digest("hex")).toBe(before);
  const colorCount = (frame: number, kind: "red" | "blue") => {
    const pixels = raw.subarray(frame * 320 * 180 * 3, (frame + 1) * 320 * 180 * 3);
    let count = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      if (kind === "blue" ? pixels[i + 2] > 120 && pixels[i + 2] > pixels[i] * 1.4 : pixels[i] > 150 && pixels[i + 1] < 90 && pixels[i + 2] < 90) count++;
    }
    return count;
  };
  expect(colorCount(15, "blue")).toBe(0);
  expect(colorCount(16, "blue")).toBeGreaterThan(20);
  expect(colorCount(29, "blue")).toBe(0);
  expect(colorCount(39, "red")).toBeGreaterThan(colorCount(0, "red") * 1.5);
  expect(raw.length / (320 * 180 * 3)).toBe(87);
});

it("renders a long action sequence and simultaneous clicks within the media budget", () => {
  const capture = join(dir, "long-capture.mp4");
  mkdirSync(dir, { recursive: true });
  media(["-f", "lavfi", "-i", "color=black:s=640x360:r=30:d=32", "-c:v", "libx264", capture]);
  const events: RunnerEvent[] = [];
  for (let i = 0; i < 30; i++) {
    const x = i % 2 ? 280 : 40;
    events.push({ t: i * 1000, type: "move", from: [320 - x, 90], to: [x, 90], durationMs: 300, easing: "easeInOutCubic" },
      { t: i * 1000 + 350, type: "click", at: [x, 90], button: "left", target: "button" });
  }
  events.push({ ...events.at(-1)! });
  const timeline = planTimeline([], { fps: 30, frames: 960, cutMs: 100 });
  const video = join(dir, "long.mp4");
  renderTimeline({ capture, master: join(dir, "long-master.mp4"), video, voice: join(dir, "long-voice.wav"),
    audioDir: dir, viewport: [320, 180], timeline, events });
  expect(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries",
    "stream=nb_read_frames", "-of", "csv=p=0", video], { encoding: "utf8" }).trim()).toBe("957");
}, 120_000);

it("keeps the arrow sprite visible during a fast cross-screen move in zoom-out", () => {
  mkdirSync(dir, { recursive: true });
  const capture = join(dir, "escape-capture.mp4");
  media(["-f", "lavfi", "-i", "color=black:s=2560x1440:r=30:d=3", "-c:v", "libx264", "-preset", "ultrafast", capture]);
  const video = join(dir, "escape.mp4");
  renderTimeline({ capture, master: join(dir, "escape-master.mp4"), video,
    voice: join(dir, "escape-voice.wav"), audioDir: dir, viewport: [1920, 1080],
    timeline: planTimeline([], { fps: 30, frames: 90, cutMs: 0 }), events: [
      { t: 0, type: "click", at: [50, 540], button: "left", target: "left" },
      { t: 2010, type: "move", from: [50, 540], to: [1900, 540], durationMs: 300, easing: "easeInOutCubic" },
    ] });
  const raw = media(["-i", video, "-vf", "select=between(n\\,67\\,69)", "-pix_fmt", "rgb24", "-an", "-fps_mode", "passthrough", "-f", "rawvideo", "-"]);
  const bytes = 1920 * 1080 * 3;
  expect(raw.length).toBe(bytes * 3);
  for (let frame = 0; frame < 3; frame++) {
    let white = 0;
    for (let i = frame * bytes; i < (frame + 1) * bytes; i += 3) if (raw[i] > 190 && raw[i + 1] > 190 && raw[i + 2] > 190) white++;
    expect(white).toBeGreaterThan(50);
  }
}, 120_000);

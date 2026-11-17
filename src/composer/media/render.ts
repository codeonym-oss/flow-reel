import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Timeline } from "../timeline.ts";
import type { ComposerEvent } from "../schema/events.ts";
import { assembleSfx } from "./sound-mix.ts";
import { polishFilters } from "./polish-render.ts";

function ffmpeg(args: string[]): string {
  return execFileSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 << 20,
  });
}

export function videoFrames(file: string): number {
  const result = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames",
    "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", file], { encoding: "utf8" });
  const frames = Number(result.trim());
  if (!Number.isInteger(frames) || frames <= 0) throw new Error(`invalid frame count in ${file}`);
  return frames;
}

function audioDurationMs(file: string): number {
  const result = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries",
    "stream=sample_rate,duration_ts,time_base", "-of", "json", file], { encoding: "utf8" });
  const { streams: [audio] } = JSON.parse(result);
  const [numerator, denominator] = String(audio?.time_base).split("/").map(Number);
  const ms = Number(audio?.duration_ts) * numerator / denominator * 1000;
  if (Number(audio?.sample_rate) !== 48000 || !Number.isFinite(ms)) throw new Error(`invalid voice duration in ${file}`);
  return ms;
}

interface Loudness {
  input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string;
}

export function measureLoudness(file: string, requireSignal = true): Loudness {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-i", file, "-vn", "-af",
    "loudnorm=I=-16:LRA=11:TP=-2:print_format=json", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 4 << 20 });
  if (r.error || r.status !== 0) throw new Error(`measuring audio failed: ${r.error?.message ?? r.stderr}`);
  const json = r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)?.[0];
  if (!json) throw new Error("audio loudness measurement is missing");
  const measured = JSON.parse(json) as Loudness;
  if (![measured.input_i, measured.input_tp, measured.input_lra, measured.input_thresh, measured.target_offset]
    .every((v) => Number.isFinite(Number(v))) && requireSignal) throw new Error("voice has no measurable audio signal");
  if (!Number.isFinite(Number(measured.input_tp)) && measured.input_tp !== "-inf") throw new Error("invalid audio peak measurement");
  return measured;
}

function assembleVoice(voice: string, audioDir: string, timeline: Timeline): boolean {
  const clips = timeline.steps.filter((s) => s.audio);
  if (!clips.length) {
    rmSync(voice, { force: true });
    rmSync(voice + ".bus.wav", { force: true });
    return false;
  }
  const samples = Math.round((timeline.frames - timeline.cutFrames) * 48000 / timeline.fps);
  const inputs = clips.flatMap((s) => ["-i", join(audioDir, s.audio!.file)]);
  const placed = clips.map((s, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,` +
    `adelay=${Math.round(s.startMs * 48)}S:all=1[a${i}]`);
  placed.push(`${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,` +
    `apad=whole_len=${samples},atrim=end_sample=${samples}[bus]`);
  const bus = `${voice}.bus.wav`;
  ffmpeg(["-v", "error", ...inputs, "-filter_complex", placed.join(";"), "-map", "[bus]", "-c:a", "pcm_f32le", bus]);
  normalizeAudio(bus, voice, samples);
  if (Math.abs(audioDurationMs(voice) - samples / 48) > 1 / 48) throw new Error("normalized voice duration disagrees with timeline");
  return true;
}

function normalizeAudio(bus: string, voice: string, samples: number): void {
  const m = measureLoudness(bus);
  // A 0.5 dB pre-encode margin leaves room for AAC true-peak overshoot. Verify the decoded result below.
  const filter = `loudnorm=I=-16:LRA=11:TP=-2:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ffmpeg(["-v", "error", "-i", bus, "-af", `${filter},aresample=48000,apad=whole_len=${samples},atrim=end_sample=${samples}`,
    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", voice]);
}

/**
 * The capture with the timeline's insertions: spans of the capture, cloned frames, images (GH-32 decision 003) and
 * cards, each from its rendered clip (GH-76 decision 003).
 */
function renderMaster(capture: string, master: string, timeline: Timeline, clips: Readonly<Record<string, string>>): void {
  const { width, height } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height", "-of", "json", capture], { encoding: "utf8" })).streams[0];
  const inputs = ["-i", capture];
  const filters: string[] = [];
  const labels: string[] = [];
  let from = 0;
  let images = 0;
  const span = (to: number, clone: number) => {
    if (to === from) return;
    const label = `s${labels.length}`;
    filters.push(`[0:v]trim=start_frame=${from}:end_frame=${to},setpts=PTS-STARTPTS,setsar=1` +
      `${clone ? `,tpad=stop_mode=clone:stop=${clone}` : ""}[${label}]`);
    labels.push(`[${label}]`);
    from = to;
  };
  // Insertions, stretches and skips in source order; at one frame, insertions play first (they never overlap a
  // stretch or a skip).
  const skipped = timeline.skips.map((s) => ({ ...s, skip: true as const }));
  const later = (x: object) => Number("kept" in x || "skip" in x);
  const cuts = [...timeline.insertions, ...timeline.stretches, ...skipped].sort((a, b) => a.frame - b.frame || later(a) - later(b));
  for (const insertion of cuts) {
    if ("skip" in insertion) {
      span(insertion.frame, 0);
      from = insertion.frame + insertion.frames;
      continue;
    }
    if ("kept" in insertion) {
      span(insertion.frame, 0);
      const to = insertion.frame + insertion.frames;
      const label = `s${labels.length}`;
      // Output frame i is source frame floor(i × f): frame n is kept when ceil(n/f) < (n+1)/f (GH-61 decision 008).
      const f = insertion.factor;
      filters.push(`[0:v]trim=start_frame=${from}:end_frame=${to},setpts=PTS-STARTPTS,setsar=1,` +
        `select='lt(ceil(n/${f}),(n+1)/${f})'[${label}]`);
      labels.push(`[${label}]`);
      from = to;
      continue;
    }
    if (insertion.card) {
      span(insertion.frame, 0);
      const clip = clips[insertion.card.id];
      if (!clip) throw new Error(`card ${insertion.card.id} wasn't rendered`);
      const input = 1 + images++;
      inputs.push("-i", clip);
      const label = `s${labels.length}`;
      filters.push(`[${input}:v]scale=${width}:${height},setsar=1,format=yuv420p,trim=end_frame=${insertion.frames},setpts=PTS-STARTPTS[${label}]`);
      labels.push(`[${label}]`);
      continue;
    }
    if (!insertion.image) {
      span(insertion.frame, insertion.frames);
      continue;
    }
    span(insertion.frame, 0);
    const { file, fit, background } = insertion.image;
    const input = 1 + images++;
    inputs.push("-loop", "1", "-framerate", String(timeline.fps), "-i", file);
    const sized = fit === "contain"
      ? `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x${background.slice(1)}`
      : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    const label = `s${labels.length}`;
    filters.push(`[${input}:v]${sized},setsar=1,format=yuv420p,trim=end_frame=${insertion.frames},setpts=PTS-STARTPTS[${label}]`);
    labels.push(`[${label}]`);
  }
  span(timeline.sourceFrames, 0);
  filters.push(`${labels.join("")}concat=n=${labels.length}:v=1:a=0,setpts=N/(${timeline.fps}*TB)[v]`);
  ffmpeg(["-v", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[v]",
    "-r", String(timeline.fps), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", master]);
}

interface RenderOptions {
  capture: string;
  master: string;
  video: string;
  voice: string;
  audioDir: string;
  viewport: [number, number];
  timeline: Timeline;
  /** Each card's rendered clip, by its id in the timeline. */
  clips?: Readonly<Record<string, string>>;
  events?: readonly ComposerEvent[];
  sound?: boolean;
  /** False when the script turned automatic zoom off. */
  autoZoom?: boolean;
}

export function renderTimeline({ capture, master, video, voice, audioDir, viewport: [width, height], timeline, clips = {}, events = [], sound = true, autoZoom = true }: RenderOptions): void {
  if (!timeline.insertions.length && !timeline.stretches.length) copyFileSync(capture, master);
  else renderMaster(capture, master, timeline, clips);
  if (videoFrames(master) !== timeline.frames) throw new Error("rendered master frame count disagrees with timeline");
  const hasVoice = assembleVoice(voice, audioDir, timeline);
  const effects = assembleSfx(events, timeline, hasVoice ? voice : undefined, dirname(voice), sound);
  let audio = hasVoice ? voice : effects;
  if (hasVoice && effects) {
    audio = join(dirname(voice), "mix.wav");
    normalizeAudio(effects, audio, Math.round((timeline.frames - timeline.cutFrames) * 48000 / timeline.fps));
  }
  const dimensions = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height", "-of", "json", master], { encoding: "utf8" })).streams[0];
  const polish = polishFilters(events, { viewport: [width, height], source: [dimensions.width, dimensions.height],
    fps: timeline.fps, frames: timeline.frames - timeline.cutFrames, autoZoom, stretches: timeline.stretches,
    // Nothing is drawn over a card either, and the crop is full (GH-62 decision 003).
    imageSpans: [...timeline.imageSpans, ...timeline.cards.map(({ startMs, endMs }) => ({ startMs, endMs }))] },
    video, audio ? 2 : 1);
  const graph = video + ".filters";
  writeFileSync(graph, `[0:v]trim=start_frame=${timeline.cutFrames},setpts=PTS-STARTPTS[trimmed];${polish.filters}`);
  // FFmpeg 8+ removed the old script option; the recording image still uses FFmpeg 6.
  const major = Number(execFileSync("ffmpeg", ["-version"], { encoding: "utf8" }).match(/ffmpeg version (\d+)/)?.[1]);
  ffmpeg(["-v", "error", "-i", master, ...(audio ? ["-i", audio] : []), ...polish.inputs,
    major >= 8 ? "-/filter_complex" : "-filter_complex_script", graph, "-map", "[polished]",
    ...(audio ? ["-map", "1:a:0", "-c:a", "aac", "-profile:a", "aac_low", "-ar", "48000", "-ac", "2", "-b:a", "192k"] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
  if (audio) {
    const expectedMs = (timeline.frames - timeline.cutFrames) * 1000 / timeline.fps;
    if (Math.abs(audioDurationMs(video) - expectedMs) > 1000 / timeline.fps) {
      throw new Error("delivered voice duration disagrees with timeline");
    }
    // A tail-trimmed, SFX-only cue may be below R128's measurement gate. It still needs a peak check.
    const m = measureLoudness(video, hasVoice);
    if ((hasVoice && Math.abs(Number(m.input_i) + 16) > 1) || Number(m.input_tp) > -1.4) {
      throw new Error(`delivered voice misses loudness target: ${m.input_i} LUFS, ${m.input_tp} dBTP`);
    }
  }
  if (videoFrames(video) !== timeline.frames - timeline.cutFrames) throw new Error("delivery frame count disagrees with timeline");
}

// ffmpeg captures the virtual display into the 1440p master (GH-2 decisions 001 and 005). The wall-clock time x11grab
// stamps on its first frame is the origin every step and event is timed on.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { DISPLAY } from "./display.ts";

export const FPS = 30;

export interface Recording {
  /** Milliseconds since the first frame of the master. */
  now(): number;
  /** Stops capturing; resolves to how long the recording ran, in milliseconds on the same clock. */
  stop(): Promise<number>;
}

/** libx264's yuv420p needs even dimensions: an odd screen (640 px × 4/3 = 853) is padded by one black pixel. */
export const EVEN_PAD = "pad=ceil(iw/2)*2:ceil(ih/2)*2";

export async function startRecording(master: string, [width, height]: [number, number]): Promise<Recording> {
  // ultrafast: slower presets fall behind real time while Chromium renders (decision 005).
  const ffmpeg: ChildProcess = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "info", "-nostats", "-y",
    "-f", "x11grab", "-draw_mouse", "0", "-framerate", String(FPS), "-thread_queue_size", "512",
    "-video_size", `${width}x${height}`, "-i", DISPLAY,
    "-vf", EVEN_PAD, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", master,
  ], { stdio: ["pipe", "ignore", "pipe"] });

  let log = "";
  ffmpeg.stderr!.on("data", (chunk: Buffer) => { log = (log + chunk.toString()).slice(-65536); });
  ffmpeg.stdin!.on("error", () => {}); // a dead encoder is reported through `exited` below
  // Registered at spawn, so an encoder that dies at any point is seen: waiting for "exit" later would hang forever.
  const exited = once(ffmpeg, "exit") as Promise<[number | null, NodeJS.Signals | null]>;
  let exitCode: number | null | undefined;
  exited.then(([code]) => { exitCode = code; }, () => { exitCode = null; });

  // x11grab stamps frames with the wall clock; "start:" is when it grabbed the first one.
  const origin = await new Promise<number>((resolve, reject) => {
    exited.then(([code]) => reject(new Error(`ffmpeg exited (${code}) before its first frame:\n${log}`)), reject);
    ffmpeg.stderr!.on("data", function onData() {
      const start = /start: (\d+\.\d+)/.exec(log)?.[1];
      if (!start) return;
      ffmpeg.stderr!.off("data", onData);
      resolve(Number(start) * 1000 - performance.timeOrigin);
    });
  });

  return {
    now: () => performance.now() - origin,
    async stop() {
      const ranMs = performance.now() - origin;
      if (exitCode === undefined) ffmpeg.stdin!.end("q");
      const [code] = await exited;
      if (code !== 0) throw new Error(`ffmpeg exited with ${code} while recording the master:\n${log.slice(-4000)}`);
      return ranMs;
    },
  };
}

export function durationMs(file: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
    encoding: "utf8",
  });
  const seconds = Number(r.stdout?.trim());
  if (r.status !== 0 || !r.stdout?.trim() || !Number.isFinite(seconds)) {
    throw new Error(`reading the duration of ${file} failed: ${r.error?.message ?? r.stderr}`);
  }
  return Math.round(seconds * 1000);
}

/**
 * The time of the first frame, within the first `withinMs` of `file`, that is entirely one colour (each channel
 * within 40 of `rgb`), or undefined.
 */
export function firstFrameOfColour(file: string, rgb: [number, number, number], withinMs: number): number | undefined {
  const r = spawnSync("ffmpeg", ["-v", "error", "-t", String(withinMs / 1000), "-i", file,
    "-vf", "scale=4:4:flags=area,format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error(`reading ${file} failed: ${r.stderr}`);
  const frameBytes = 4 * 4 * 3;
  for (let f = 0; (f + 1) * frameBytes <= r.stdout.length; f++) {
    const px = r.stdout.subarray(f * frameBytes, (f + 1) * frameBytes);
    if (px.every((v, i) => Math.abs(v - rgb[i % 3]) <= 40)) return (f * 1000) / FPS;
  }
  return undefined;
}

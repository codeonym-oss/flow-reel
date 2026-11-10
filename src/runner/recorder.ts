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

export async function startRecording(master: string, [width, height]: [number, number]): Promise<Recording> {
  // ultrafast: slower presets fall behind real time while Chromium renders (decision 005).
  const ffmpeg: ChildProcess = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "info", "-nostats", "-y",
    "-f", "x11grab", "-draw_mouse", "0", "-framerate", String(FPS), "-thread_queue_size", "512",
    "-video_size", `${width}x${height}`, "-i", DISPLAY,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", master,
  ], { stdio: ["pipe", "ignore", "pipe"] });

  let log = "";
  // x11grab stamps frames with the wall clock; "start:" is when it grabbed the first one.
  const origin = await new Promise<number>((resolve, reject) => {
    ffmpeg.once("exit", (code) => reject(new Error(`ffmpeg exited (${code}) before its first frame:\n${log}`)));
    ffmpeg.stderr!.on("data", function onData(chunk: Buffer) {
      log += chunk.toString();
      const start = /start: (\d+\.\d+)/.exec(log)?.[1];
      if (!start) return;
      ffmpeg.stderr!.off("data", onData);
      resolve(Number(start) * 1000 - performance.timeOrigin);
    });
  });
  ffmpeg.removeAllListeners("exit");
  ffmpeg.stderr!.resume();

  return {
    now: () => performance.now() - origin,
    async stop() {
      const ranMs = performance.now() - origin;
      const exited = once(ffmpeg, "exit");
      ffmpeg.stdin!.end("q");
      const [code] = await exited;
      if (code !== 0) throw new Error(`ffmpeg exited with ${code} while finishing the master`);
      return ranMs;
    },
  };
}

/** The silent 1080p delivery copy, starting `startMs` into the master. */
export function downscale(master: string, out: string, [width, height]: [number, number], startMs: number): void {
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", master, "-ss", String(startMs / 1000),
    "-vf", `scale=${width}:${height}:flags=lanczos`, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`downscaling to ${out} failed`);
}

export function durationMs(file: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
    encoding: "utf8",
  });
  return Math.round(Number(r.stdout.trim()) * 1000);
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

// The live picture's grab (GH-138 decision 003): a second ffmpeg on the virtual screen, small, slow and niced, that runs
// only while someone watches the recording.
import { spawn } from "node:child_process";
import { DISPLAY } from "./display.ts";

export const PICTURES_PER_SECOND = 4;
export const PICTURE_WIDTH = 800;

/** Where the JPEG starting at `start` ends, or undefined when it hasn't all arrived; -1 when it isn't a JPEG. */
function jpegEnd(data: Buffer, start: number): number | undefined {
  // The segments before the picture's data carry their length; the data itself escapes FF, so FF D9 ends it.
  let at = start + 2;
  for (;;) {
    if (at + 4 > data.length) return undefined;
    if (data[at] !== 0xff) return -1;
    const marker = data[at + 1]!;
    if (marker === 0xff) { at++; continue; }
    at += 2 + data.readUInt16BE(at + 2);
    if (marker === 0xda) break;
  }
  for (; at + 1 < data.length; at++) {
    if (data[at] === 0xff && data[at + 1] !== 0) {
      if (data[at + 1] === 0xd9) return at + 2;
      at++;
    }
  }
  return undefined;
}

const SOI = Buffer.from([0xff, 0xd8, 0xff]);

/** Cuts the JPEGs out of a stream, whatever pieces it arrives in; what isn't one is skipped. */
export function jpegCutter(picture: (jpeg: Buffer) => void): (chunk: Buffer) => void {
  let rest: Buffer = Buffer.alloc(0);
  return (chunk) => {
    rest = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    for (;;) {
      const start = rest.indexOf(SOI);
      if (start < 0) { rest = rest.subarray(Math.max(0, rest.length - 2)); return; }
      const end = jpegEnd(rest, start);
      if (end === undefined) { rest = Buffer.from(rest.subarray(start)); return; }
      if (end === -1) { rest = rest.subarray(start + 1); continue; }
      picture(Buffer.from(rest.subarray(start, end)));
      rest = rest.subarray(end);
    }
  };
}

export interface Pictures { stop(): void }

/** Grabs the virtual screen until stopped; `ended` is called when ffmpeg exits by itself, as when there's no screen yet. */
export function startPictures(picture: (jpeg: Buffer) => void, ended: () => void): Pictures {
  // One thread and the cheapest smooth scaler: about a sixth of a core, where ffmpeg's defaults take half of one.
  const ffmpeg = spawn("nice", ["-n", "19", "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostats", "-threads", "1",
    "-f", "x11grab", "-draw_mouse", "0", "-framerate", String(PICTURES_PER_SECOND), "-i", DISPLAY, "-filter_threads", "1",
    "-vf", `scale=${PICTURE_WIDTH}:-2:flags=fast_bilinear`, "-threads", "1", "-c:v", "mjpeg", "-q:v", "7", "-f", "image2pipe", "-"], { stdio: ["ignore", "pipe", "ignore"] });
  let stopped = false;
  ffmpeg.stdout.on("data", jpegCutter(picture));
  ffmpeg.on("error", () => {}).on("exit", () => { if (!stopped) ended(); });
  return { stop() { stopped = true; ffmpeg.kill(); } };
}

// One small picture per step, cut from the capture once the recording has passed its checks (GH-139 decision 003).
import { spawnSync } from "node:child_process";
import { copyFileSync as copyFile, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { STEP_PICTURES_DIR, stepPictureFile } from "../schema/files.ts";
import type { TranscriptStep } from "../schema/transcript.ts";

export const STEP_PICTURE_WIDTH = 320;
const INTO_MS = 500;

/** The capture frame of each step: the end of its action, or 0.5 s in when the action is shorter, never past its end. */
export function stepFrames(steps: readonly TranscriptStep[], cutMs: number, fps: number, frames: number): number[] {
  return steps.map((step) => {
    const ms = Math.min(step.endMs, Math.max(step.actionEndMs, step.startMs + INTO_MS));
    return Math.min(frames - 1, Math.max(0, Math.round(((cutMs + ms) * fps) / 1000)));
  });
}

/** Writes `steps/000.jpg`… into `out` in one ffmpeg pass; steps on the same frame share its picture. */
export function cutStepPictures(capture: string, frames: readonly number[], out: string): void {
  if (!frames.length) return;
  const dir = join(out, STEP_PICTURES_DIR);
  mkdirSync(dir, { recursive: true });
  const unique = [...new Set(frames)].sort((a, b) => a - b);
  const select = unique.map((n) => `eq(n\\,${n})`).join("+");
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-v", "error", "-i", capture,
    "-vf", `select='${select}',scale=${STEP_PICTURE_WIDTH}:-2:flags=bilinear`, "-fps_mode", "passthrough",
    "-q:v", "5", join(dir, "frame-%05d.jpg")], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`cutting the step pictures failed: ${r.stderr || r.error?.message}`);
  const cut = (i: number) => join(dir, `frame-${String(i + 1).padStart(5, "0")}.jpg`);
  frames.forEach((frame, index) => copyFile(cut(unique.indexOf(frame)), join(dir, stepPictureFile(index))));
  unique.forEach((_, i) => rmSync(cut(i)));
}

// A recorded run's score, from its record result, for the studio (GH-139 decisions 001 to 003).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CueSheet } from "../composer/schema/cues.ts";
import type { ComposerEvent } from "../composer/schema/events.ts";
import { CUES_FILE, STEP_PICTURES_DIR, stepPictureFile } from "../composer/schema/files.ts";
import { resultDir } from "./results.ts";

export interface ScoreMark { lane: "sounds" | "effects" | "cards"; t: number; ms?: number; label: string }
export interface Score {
  durationMs: number;
  steps: { index: number; comment?: string; startMs: number; endMs: number; picture: boolean }[];
  marks: ScoreMark[];
}

function markOf(event: ComposerEvent): ScoreMark | undefined {
  const { t } = event;
  switch (event.type) {
    case "sound": return { lane: "sounds", t, label: event.name };
    case "zoom": return { lane: "effects", t, ms: event.ms, label: `zoom ${event.zoom}` };
    case "speed": return { lane: "effects", t, ms: event.durationMs, label: `speed-up ×${event.factor}` };
    case "skip": return { lane: "effects", t, ms: event.durationMs, label: `skip · ${event.label}` };
    case "flash": return { lane: "effects", t, ms: event.ms, label: "flash" };
    case "overlay": return { lane: "effects", t, ms: event.durationMs, label: event.overlay };
    case "card": return { lane: "cards", t, label: event.card };
    default: return undefined;
  }
}

/** The score of a run whose record phase is finished; none before. */
export function scoreOf(runDir: string): Score | undefined {
  const dir = resultDir(runDir, "record");
  const file = join(dir, CUES_FILE);
  if (!existsSync(file)) return undefined;
  const cues = JSON.parse(readFileSync(file, "utf8")) as CueSheet;
  const captured = (cues.capture.frames * 1000) / cues.fps - cues.capture.cutMs;
  const steps = cues.steps.map((step) => ({ index: step.index, ...(step.comment === undefined ? {} : { comment: step.comment }),
    startMs: step.startMs, endMs: step.endMs, picture: existsSync(join(dir, STEP_PICTURES_DIR, stepPictureFile(step.index))) }));
  const marks = cues.events.flatMap((event) => markOf(event) ?? []).map((mark) => ({ ...mark, t: Math.max(0, Math.round(mark.t)) }));
  return { durationMs: Math.round(Math.max(captured, ...steps.map((step) => step.endMs))), steps, marks };
}

/** A step's picture file, if it was cut. */
export function stepPicture(runDir: string, index: number): string | undefined {
  if (!Number.isInteger(index) || index < 0) return undefined;
  const file = join(resultDir(runDir, "record"), STEP_PICTURES_DIR, stepPictureFile(index));
  return existsSync(file) ? file : undefined;
}

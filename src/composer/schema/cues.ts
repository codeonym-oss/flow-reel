// cues.json, the cue sheet: what recording a script produced, besides the capture (epic GH-107 decision 031). Every later
// phase reads it and never the script. Times are milliseconds on the video's clock, before anything is inserted or cut.
import { type Errors, isObject, nonNegative, text } from "./check.ts";
import { type ComposerEvent, validateEvents } from "./events.ts";
import { type TranscriptStep, validateTranscript } from "./transcript.ts";

export interface CueSheet {
  version: 1;
  /** The script's path in the scripts folder, and its hash. */
  script: { file: string; sha256: string };
  integration: string;
  /** The machine the capture was made on, as `linux/amd64`. */
  platform: string;
  viewport: [width: number, height: number];
  fps: number;
  /** False when the script turned automatic zoom off. */
  autoZoom: boolean;
  /** The capture's frames, and where in it the video starts. */
  capture: { file: string; frames: number; cutMs: number };
  /** The script's steps, without audio. */
  steps: TranscriptStep[];
  events: ComposerEvent[];
}

export function validateCues(value: unknown): Errors {
  if (!isObject(value)) return ["cue sheet must be an object"];
  if (value.version !== 1) return ["version must be 1"];
  const errors: Errors = [];
  if (!isObject(value.script)) errors.push("script must be an object");
  else for (const key of ["file", "sha256"]) text(errors, "script.", value.script, key);
  for (const key of ["integration", "platform"]) text(errors, "", value, key);
  const { viewport } = value;
  if (!Array.isArray(viewport) || viewport.length !== 2 || !viewport.every((n) => Number.isInteger(n) && n > 0)) {
    errors.push("viewport must be [width, height] in whole CSS pixels");
    return errors;
  }
  nonNegative(errors, "", value, "fps");
  if (!isObject(value.capture)) errors.push("capture must be an object");
  else {
    text(errors, "capture.", value.capture, "file");
    for (const key of ["frames", "cutMs"]) nonNegative(errors, "capture.", value.capture, key);
  }
  // The steps and the events have the transcript's and the event log's shapes.
  const video = { file: "video.mp4", width: viewport[0], height: viewport[1], fps: value.fps, durationMs: 0 };
  errors.push(...validateTranscript({ version: 2, script: "", video, steps: value.steps }));
  errors.push(...validateEvents({ version: 6, autoZoom: value.autoZoom, events: value.events }));
  return errors;
}

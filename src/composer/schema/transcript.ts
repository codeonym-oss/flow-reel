// transcript.json (story decision 011); version 2 names a step's spoken line `comment` (GH-30 decision 003). Voice,
// comment and audio are optional here.
import { type Errors, isObject, nonNegative, text } from "./check.ts";

export interface Transcript {
  version: 2;
  script: string;
  video: { file: string; width: number; height: number; fps: number; durationMs: number };
  voice?: { adapter: string; voice: string; seed: number; language: string };
  steps: TranscriptStep[];
}

export interface TranscriptStep {
  index: number;
  comment?: string;
  startMs: number;
  actionEndMs: number;
  endMs: number;
  audio?: { file: string; durationMs: number; sha256: string };
}

export function validateTranscript(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["transcript must be an object"];
  if (value.version !== 2) errors.push("version must be 2");
  text(errors, "", value, "script");

  if (!isObject(value.video)) errors.push("video must be an object");
  else {
    text(errors, "video.", value.video, "file");
    for (const key of ["width", "height", "fps", "durationMs"]) nonNegative(errors, "video.", value.video, key);
  }

  if (value.voice !== undefined) {
    if (!isObject(value.voice)) errors.push("voice must be an object");
    else {
      text(errors, "voice.", value.voice, "adapter");
      text(errors, "voice.", value.voice, "voice");
      text(errors, "voice.", value.voice, "language");
      nonNegative(errors, "voice.", value.voice, "seed");
    }
  }

  if (!Array.isArray(value.steps)) return [...errors, "steps must be an array"];
  value.steps.forEach((step, i) => {
    const where = `steps[${i}]: `;
    if (!isObject(step)) return void errors.push(`${where}must be an object`);
    if (step.index !== i) errors.push(`${where}index must be ${i}`);
    if (step.comment !== undefined) text(errors, where, step, "comment");
    for (const key of ["startMs", "actionEndMs", "endMs"]) nonNegative(errors, where, step, key);
    const { startMs, actionEndMs, endMs } = step as Record<string, number>;
    if (actionEndMs < startMs) errors.push(`${where}actionEndMs must be >= startMs`);
    if (endMs < actionEndMs) errors.push(`${where}endMs must be >= actionEndMs`);
    if (step.audio !== undefined) {
      if (!isObject(step.audio)) errors.push(`${where}audio must be an object`);
      else {
        text(errors, `${where}audio.`, step.audio, "file");
        nonNegative(errors, `${where}audio.`, step.audio, "durationMs");
        text(errors, `${where}audio.`, step.audio, "sha256");
      }
    }
  });
  return errors;
}

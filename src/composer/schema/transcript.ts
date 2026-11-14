// transcript.json, version 1 (story decision 011). Each ticket fills its own fields, so voice, narration and audio
// are optional here.
import { type Errors, isObject, nonNegative, text } from "./check.ts";

export interface Transcript {
  version: 1;
  script: string;
  video: { file: string; width: number; height: number; fps: number; durationMs: number };
  voice?: { adapter: string; voice: string; seed: number };
  steps: TranscriptStep[];
}

export interface TranscriptStep {
  index: number;
  narration?: string;
  startMs: number;
  actionEndMs: number;
  endMs: number;
  audio?: { file: string; durationMs: number; sha256: string };
}

export function validateTranscript(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["transcript must be an object"];
  if (value.version !== 1) errors.push("version must be 1");
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
      nonNegative(errors, "voice.", value.voice, "seed");
    }
  }

  if (!Array.isArray(value.steps)) return [...errors, "steps must be an array"];
  value.steps.forEach((step, i) => {
    const where = `steps[${i}]: `;
    if (!isObject(step)) return void errors.push(`${where}must be an object`);
    if (step.index !== i) errors.push(`${where}index must be ${i}`);
    if (step.narration !== undefined) text(errors, where, step, "narration");
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

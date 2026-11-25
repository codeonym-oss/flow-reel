// voice.json: which clip speaks each step's comment, and the voice that spoke them.
import { type Errors, isObject, nonNegative, text } from "./check.ts";
import type { Transcript, TranscriptStep } from "./transcript.ts";

export interface Voiced {
  version: 1;
  voice: NonNullable<Transcript["voice"]>;
  clips: { step: number; audio: NonNullable<TranscriptStep["audio"]> }[];
}

export function validateVoiced(value: unknown): Errors {
  if (!isObject(value)) return ["voice must be an object"];
  if (value.version !== 1) return ["version must be 1"];
  const errors: Errors = [];
  if (!isObject(value.voice)) errors.push("voice must be an object");
  else {
    for (const key of ["adapter", "voice", "language"]) text(errors, "voice.", value.voice, key);
    nonNegative(errors, "voice.", value.voice, "seed");
  }
  if (!Array.isArray(value.clips)) return [...errors, "clips must be an array"];
  value.clips.forEach((clip, i) => {
    const where = `clips[${i}]: `;
    if (!isObject(clip) || !isObject(clip.audio)) return void errors.push(`${where}must have a step and its audio`);
    nonNegative(errors, where, clip, "step");
    for (const key of ["file", "sha256"]) text(errors, `${where}audio.`, clip.audio, key);
    nonNegative(errors, `${where}audio.`, clip.audio, "durationMs");
  });
  return errors;
}

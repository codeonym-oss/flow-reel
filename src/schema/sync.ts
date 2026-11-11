import { type Transcript, validateTranscript } from "./transcript.ts";

/** Semantic checks for a finished recording, separate from the backward-compatible v1 shape validator. */
export function validateSync(value: unknown): string[] {
  const errors = validateTranscript(value);
  if (errors.length) return errors;
  const t = value as Transcript;
  for (const key of ["width", "height", "fps"] as const) {
    if (t.video[key] <= 0) errors.push(`video.${key} must be positive`);
  }
  if (t.voice && (!t.voice.adapter.trim() || !t.voice.voice.trim())) errors.push("voice identity must be nonempty");
  t.steps.forEach((step, i) => {
    const where = `steps[${i}]: `;
    if (i && step.startMs < t.steps[i - 1].endMs) errors.push(`${where}window overlaps the previous step`);
    if (step.endMs > t.video.durationMs + 1e-6) errors.push(`${where}endMs exceeds video durationMs`);
    if (t.voice && step.narration?.trim() && !step.audio) {
      errors.push(`${where}nonblank narration needs audio when voice is configured`);
    }
    if (step.audio) {
      if (!/^[a-f0-9]{64}$/i.test(step.audio.sha256)) errors.push(`${where}audio.sha256 must be a SHA-256 hex digest`);
      if (step.audio.durationMs <= 0) errors.push(`${where}audio.durationMs must be positive`);
      if (!step.audio.file.trim()) errors.push(`${where}audio.file must be nonempty`);
    }
    if (step.audio && step.startMs + step.audio.durationMs + 200 > step.endMs + 1e-6) {
      errors.push(`steps[${i}]: audio needs its full duration plus 200 ms tail`);
    }
  });
  return errors;
}

import { validateSync } from "./schema/sync.ts";
import type { Transcript } from "./schema/transcript.ts";

/** Compare transcript data only: paths and encoded media bytes are not content identity. */
export function compareTranscripts(left: unknown, right: unknown): { errors: string[]; differences: string[] } {
  const errors = [...validateSync(left).map((e) => `left: ${e}`), ...validateSync(right).map((e) => `right: ${e}`)];
  const differences: string[] = [];
  if (errors.length) return { errors, differences };
  const a = left as Transcript; const b = right as Transcript;
  const compare = (name: string, x: unknown, y: unknown) => { if (x !== y) differences.push(`${name} differs`); };
  for (const key of ["width", "height", "fps"] as const) compare(`video.${key}`, a.video[key], b.video[key]);
  compare("voice presence", Boolean(a.voice), Boolean(b.voice));
  if (a.voice && b.voice) {
    for (const key of ["adapter", "voice", "seed"] as const) compare(`voice.${key}`, a.voice[key], b.voice[key]);
  }
  compare("step count", a.steps.length, b.steps.length);
  a.steps.forEach((s, i) => {
    const other = b.steps[i];
    if (!other) return;
    compare(`steps[${i}].narration`, s.narration, other.narration);
    compare(`steps[${i}].audio presence`, Boolean(s.audio), Boolean(other.audio));
    if (s.audio && other.audio) {
      for (const key of ["sha256", "durationMs"] as const) compare(`steps[${i}].audio.${key}`, s.audio[key], other.audio[key]);
    }
    const drift = Math.abs(s.startMs - other.startMs);
    if (drift > 150) differences.push(`steps[${i}].startMs differs by ${drift} ms (maximum 150 ms)`);
  });
  return { errors, differences };
}

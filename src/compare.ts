import { type ComposerEvent, type EventLog, validateEvents } from "./composer/schema/events.ts";
import { validateSync } from "./composer/schema/sync.ts";
import type { Transcript } from "./composer/schema/transcript.ts";

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
    for (const key of ["adapter", "voice", "seed", "language"] as const) compare(`voice.${key}`, a.voice[key], b.voice[key]);
  }
  compare("step count", a.steps.length, b.steps.length);
  a.steps.forEach((s, i) => {
    const other = b.steps[i];
    if (!other) return;
    compare(`steps[${i}].comment`, s.comment, other.comment);
    compare(`steps[${i}].audio presence`, Boolean(s.audio), Boolean(other.audio));
    if (s.audio && other.audio) {
      for (const key of ["sha256", "durationMs"] as const) compare(`steps[${i}].audio.${key}`, s.audio[key], other.audio[key]);
    }
    const drift = Math.abs(s.startMs - other.startMs);
    if (drift > 150) differences.push(`steps[${i}].startMs differs by ${drift} ms (maximum 150 ms)`);
  });
  return { errors, differences };
}

const EFFECTS = ["flash", "zoom", "speed", "skip", "card", "overlay"];
// Times may differ between honest composes, and so may how long a sped-up or skipped wait took or an overlay showed
// (GH-61 decision 005, GH-62 decision 004, GH-76 decision 007); everything else an effect asked for must match.
const effectKeys = (event: ComposerEvent) => Object.keys(event)
  .filter((key) => key !== "t" && !(["speed", "skip", "overlay"].includes(event.type) && key === "durationMs")).sort();

/**
 * Compare the effects of two event logs (GH-32 decision 007): the same `autoZoom`, and the same flashes,
 * zooms, speed-ups, skips and cards in the same order with the same options, props and file hashes, each starting
 * within 150 ms. Clicks,
 * moves, typing, scrolls and sounds come from the app and are not compared.
 */
export function compareEffects(left: unknown, right: unknown): { errors: string[]; differences: string[] } {
  const errors = [...validateEvents(left).map((e) => `left: events.json: ${e}`), ...validateEvents(right).map((e) => `right: events.json: ${e}`)];
  const differences: string[] = [];
  if (errors.length) return { errors, differences };
  const a = left as EventLog; const b = right as EventLog;
  if (a.autoZoom !== b.autoZoom) differences.push("autoZoom differs");
  const effects = (log: EventLog) => log.events.filter((e) => EFFECTS.includes(e.type));
  const [x, y] = [effects(a), effects(b)];
  if (x.length !== y.length) differences.push(`effect count differs (${x.length} and ${y.length})`);
  x.forEach((e, i) => {
    const other = y[i];
    if (!other) return;
    const name = `effects[${i}] (${e.type})`;
    const same = e.type === other.type && JSON.stringify(effectKeys(e)) === JSON.stringify(effectKeys(other)) &&
      effectKeys(e).every((key) => JSON.stringify(e[key as keyof ComposerEvent]) === JSON.stringify(other[key as keyof ComposerEvent]));
    if (!same) differences.push(`${name} differs`);
    const drift = Math.abs(e.t - other.t);
    if (drift > 150) differences.push(`${name} starts ${Math.round(drift)} ms apart (maximum 150 ms)`);
  });
  return { errors, differences };
}

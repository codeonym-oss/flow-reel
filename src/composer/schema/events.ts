// The event log: v1 actions (story decision 013), v2 added sound cues, v3 names them `sound` (GH-30 decision 003).
import { type Errors, isObject, nonNegative, point, text } from "./check.ts";

export type Point = [x: number, y: number];
export interface Bounds { x: number; y: number; width: number; height: number }

// A script names a sound by a constant (GH-30 decisions 004 and 005), so `Sound` is branded: a bare string isn't one.
declare const brand: unique symbol;
const SOUND_GROUPS = {
  feedback: { SUCCESS: "success", ERROR: "error", NOTIFICATION: "notification" },
  navigation: { OPEN: "open", CLOSE: "close", BACK: "back" },
  controls: { TOGGLE: "toggle", SELECT: "select" },
} as const;
type Groups = typeof SOUND_GROUPS;
/** What the event log records for a sound. */
export type SoundName = { [G in keyof Groups]: Groups[G][keyof Groups[G]] }[keyof Groups];
/** A sound a script can play: one of the `Sounds` constants. */
export type Sound = SoundName & { readonly [brand]: true };
/** The sounds a script can play, grouped by what they mean. Clicks and typing sound by themselves. */
export const Sounds = SOUND_GROUPS as { readonly [G in keyof Groups]: { readonly [K in keyof Groups[G]]: Sound } };
export const SOUND_NAMES = Object.values(SOUND_GROUPS).flatMap((group) => Object.values(group)) as SoundName[];

export type ComposerEvent =
  | { t: number; type: "move"; from: Point; to: Point; durationMs: number; easing: string }
  | { t: number; type: "click"; at: Point; button: "left" | "right" | "middle"; target: string; bounds?: Bounds }
  | { t: number; type: "type"; text: string; charDelayMs: number; target: string; bounds?: Bounds }
  | { t: number; type: "scroll"; delta: Point; durationMs: number }
  | { t: number; type: "sound"; name: SoundName };

export interface EventLog {
  version: 3;
  events: ComposerEvent[];
}

export function validateEvents(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["events log must be an object"];
  if (value.version !== 3) errors.push("version must be 3");
  if (!Array.isArray(value.events)) return [...errors, "events must be an array"];

  value.events.forEach((event, i) => {
    const where = `events[${i}]: `;
    if (!isObject(event)) return void errors.push(`${where}must be an object`);
    nonNegative(errors, where, event, "t");
    if ((event.type === "click" || event.type === "type") && event.bounds !== undefined) {
      const b = event.bounds;
      if (!isObject(b) || ![b.x, b.y, b.width, b.height].every((v) => typeof v === "number" && Number.isFinite(v)) ||
        Number(b.width) <= 0 || Number(b.height) <= 0) errors.push(`${where}bounds must have finite x/y and positive width/height`);
    }
    switch (event.type) {
      case "sound":
        if (!SOUND_NAMES.includes(event.name as SoundName)) errors.push(`${where}unknown sound ${JSON.stringify(event.name)}`);
        break;
      case "move":
        point(errors, where, event, "from");
        point(errors, where, event, "to");
        nonNegative(errors, where, event, "durationMs");
        text(errors, where, event, "easing");
        break;
      case "click":
        point(errors, where, event, "at");
        if (!["left", "right", "middle"].includes(event.button as string)) errors.push(`${where}button is invalid`);
        text(errors, where, event, "target");
        break;
      case "type":
        text(errors, where, event, "text");
        nonNegative(errors, where, event, "charDelayMs");
        text(errors, where, event, "target");
        break;
      case "scroll":
        point(errors, where, event, "delta");
        nonNegative(errors, where, event, "durationMs");
        break;
      default:
        errors.push(`${where}unknown type ${JSON.stringify(event.type)}`);
    }
  });
  return errors;
}

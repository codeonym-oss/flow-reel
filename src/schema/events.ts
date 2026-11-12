// events.json: v1 actions (story decision 013), v2 adds explicit sound cues on the same clock.
import { type Errors, isObject, nonNegative, point, text } from "./check.ts";

export type Point = [x: number, y: number];
export interface Bounds { x: number; y: number; width: number; height: number }
export const SFX_NAMES = ["success", "error", "notification", "open", "close", "toggle", "back", "select"] as const;
export type SfxName = typeof SFX_NAMES[number];

export type RunnerEvent =
  | { t: number; type: "move"; from: Point; to: Point; durationMs: number; easing: string }
  | { t: number; type: "click"; at: Point; button: "left" | "right" | "middle"; target: string; bounds?: Bounds }
  | { t: number; type: "type"; text: string; charDelayMs: number; target: string; bounds?: Bounds }
  | { t: number; type: "scroll"; delta: Point; durationMs: number }
  | { t: number; type: "sfx"; name: SfxName };

export interface EventLog {
  version: 1 | 2;
  events: RunnerEvent[];
}

export function validateEvents(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["events log must be an object"];
  if (value.version !== 1 && value.version !== 2) errors.push("version must be 1 or 2");
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
      case "sfx":
        if (value.version !== 2) errors.push(`${where}sfx requires event version 2`);
        if (!SFX_NAMES.includes(event.name as SfxName)) errors.push(`${where}unknown sound cue ${JSON.stringify(event.name)}`);
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

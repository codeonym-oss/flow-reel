// events.json, version 1 (story decision 013): what the runner did, in CSS pixels, on the transcript's clock.
import { type Errors, isObject, nonNegative, point, text } from "./check.ts";

export type Point = [x: number, y: number];

export type RunnerEvent =
  | { t: number; type: "move"; from: Point; to: Point; durationMs: number; easing: string }
  | { t: number; type: "click"; at: Point; button: "left" | "right" | "middle"; target: string }
  | { t: number; type: "type"; text: string; charDelayMs: number; target: string }
  | { t: number; type: "scroll"; delta: Point; durationMs: number };

export interface EventLog {
  version: 1;
  events: RunnerEvent[];
}

export function validateEvents(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["events log must be an object"];
  if (value.version !== 1) errors.push("version must be 1");
  if (!Array.isArray(value.events)) return [...errors, "events must be an array"];

  value.events.forEach((event, i) => {
    const where = `events[${i}]: `;
    if (!isObject(event)) return void errors.push(`${where}must be an object`);
    nonNegative(errors, where, event, "t");
    switch (event.type) {
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

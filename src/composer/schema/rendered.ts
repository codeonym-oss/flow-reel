// render.json: what only the finished video can tell.
import { type Errors, isObject, nonNegative } from "./check.ts";

export interface Rendered { version: 1; durationMs: number }

export function validateRendered(value: unknown): Errors {
  if (!isObject(value)) return ["render must be an object"];
  if (value.version !== 1) return ["version must be 1"];
  const errors: Errors = [];
  nonNegative(errors, "", value, "durationMs");
  return errors;
}

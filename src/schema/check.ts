// Small helpers for the hand-written validators: each returns an error message or nothing.

export type Errors = string[];

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function nonNegative(errors: Errors, where: string, obj: Record<string, unknown>, key: string): void {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) errors.push(`${where}${key} must be a number >= 0`);
}

export function text(errors: Errors, where: string, obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== "string") errors.push(`${where}${key} must be a string`);
}

export function point(errors: Errors, where: string, obj: Record<string, unknown>, key: string): void {
  const v = obj[key];
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number" && Number.isFinite(n))) {
    errors.push(`${where}${key} must be [x, y]`);
  }
}

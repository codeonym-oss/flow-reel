import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Errors } from "./check.ts";

/** Reads a JSON file of a known shape; throws naming the file and what is wrong with it. */
export function readJson<T>(file: string, validate: (value: unknown) => Errors): T {
  let value: unknown;
  try { value = JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { throw new Error(`${basename(file)} can't be read: ${(error as Error).message}`, { cause: error }); }
  const errors = validate(value);
  if (errors.length) throw new Error(`${basename(file)} is invalid:\n  ${errors.join("\n  ")}`);
  return value as T;
}

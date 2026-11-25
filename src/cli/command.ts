// What every command of the CLI is: its usage, and how it runs. `parse` reads arguments the same way for all of them.
import { parseArgs } from "node:util";

/** How a command ended, as the process's exit code. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const;

export interface Command {
  /** One line for the list of commands. */
  summary: string;
  usage: string;
  run(args: string[]): Promise<number> | number;
}

/** The arguments don't fit the command: its usage is printed, and nothing runs. */
export class UsageError extends Error {}

type Flags = Record<string, "text" | "switch">;
export type Parsed<F extends Flags> = { positionals: string[]; flags: { [K in keyof F]?: F[K] extends "text" ? string : true } };

/** Reads a command's arguments; throws a UsageError for an unknown flag, a missing value, or a flag given twice. */
export function parse<const F extends Flags>(args: string[], flags: F, count: { min: number; max: number }): Parsed<F> {
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, tokens: true,
      options: Object.fromEntries(Object.entries(flags).map(([name, kind]) => [name, { type: kind === "text" ? "string" as const : "boolean" as const }])) });
  } catch (error) { throw new UsageError((error as Error).message.split("\n")[0]); }
  const given = parsed.tokens.flatMap((token) => token.kind === "option" ? [token.name] : []);
  const twice = given.find((name, i) => given.indexOf(name) !== i);
  if (twice) throw new UsageError(`--${twice} is given twice`);
  if (parsed.positionals.length < count.min) throw new UsageError("an argument is missing");
  if (parsed.positionals.length > count.max) throw new UsageError(`unexpected argument ${JSON.stringify(parsed.positionals[count.max])}`);
  return { positionals: parsed.positionals, flags: parsed.values } as Parsed<F>;
}

// A run's journal as text: one JSON entry per line, appended, never changed (epic GH-107 decision 031). The entries in order
// are the run. Pure; the host reads and writes the file.
import { type RunEvent, type RunState, next } from "./machine.ts";

export const JOURNAL_VERSION = 1;

/** An event and when it happened, in ISO time. */
export type Entry = RunEvent & { v: typeof JOURNAL_VERSION; at: string };

export const entry = (event: RunEvent, at: Date): Entry => ({ v: JOURNAL_VERSION, at: at.toISOString(), ...event });
export const line = (entry: Entry): string => `${JSON.stringify(entry)}\n`;

/**
 * Reads entries from a journal's text. A last line without its end is being written, or was cut short: it isn't an entry,
 * and `length` is where it starts.
 */
export function readEntries(text: string): { entries: Entry[]; length: number } {
  const length = text.lastIndexOf("\n") + 1;
  const entries = text.slice(0, length).split("\n").filter(Boolean).map((raw, i): Entry => {
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error(`the journal's line ${i + 1} isn't JSON`); }
    const { v, type } = (typeof value === "object" && value !== null ? value : {}) as { v?: unknown; type?: unknown };
    if (v !== JOURNAL_VERSION) throw new Error(`the journal's line ${i + 1} has version ${JSON.stringify(v)}; this flow-reel reads version ${JOURNAL_VERSION}`);
    if (typeof type !== "string") throw new Error(`the journal's line ${i + 1} has no type`);
    return value as Entry;
  });
  return { entries, length };
}

/** The state the entries lead to, from `run` on; undefined when there are none. */
export const replay = (entries: readonly Entry[], run?: RunState): RunState | undefined =>
  entries.reduce<RunState | undefined>(next, run);

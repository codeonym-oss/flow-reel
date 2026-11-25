// A run's journal as a file (epic GH-107 decision 031): one writer appends to it, and it is the run. Anyone may read it
// meanwhile.
import { closeSync, fsyncSync, ftruncateSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { type Entry, entry, line, readEntries, replay } from "../run/journal.ts";
import { type RunEvent, type RunState, next } from "../run/machine.ts";

export const JOURNAL_FILE = "journal.jsonl";

const journalFile = (runDir: string) => join(runDir, JOURNAL_FILE);

/** The entries of a run, as far as they are written. */
export const readJournal = (runDir: string): Entry[] => readEntries(readFileSync(journalFile(runDir), "utf8")).entries;

export interface Journal {
  /** The run's state: the entries applied in order. */
  readonly state: RunState;
  /** Adds an event. It is on the disk when this returns; one that can't happen to the run throws, and isn't added. */
  append(event: RunEvent): Entry;
  close(): void;
}

/** Opens a run's journal to write it; only the run's owner may. A line that was cut short is removed. */
export function openJournal(runDir: string, now: () => Date = () => new Date()): Journal {
  const text = readFileSync(journalFile(runDir), "utf8");
  const { entries, length } = readEntries(text);
  const initial = replay(entries);
  if (!initial) throw new Error(`${journalFile(runDir)} is empty`);
  let state = initial;
  const descriptor = openSync(journalFile(runDir), "r+");
  let end = Buffer.byteLength(text.slice(0, length));
  ftruncateSync(descriptor, end);
  return {
    get state() { return state; },
    append(event) {
      const after = next(state, event);
      const added = entry(event, now());
      const bytes = Buffer.from(line(added));
      for (let written = 0; written < bytes.length; ) written += writeSync(descriptor, bytes, written, bytes.length - written, end + written);
      // What a phase says while it works may be lost in a power cut; what changes the run's state may not.
      if (event.type !== "progress") fsyncSync(descriptor);
      end += bytes.length;
      state = after;
      return added;
    },
    close() { closeSync(descriptor); },
  };
}

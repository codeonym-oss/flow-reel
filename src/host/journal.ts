// A run's journal as a file (epic GH-107 decision 031): one writer appends to it, and it is the run. Anyone may read it
// meanwhile.
import { closeSync, constants, fstatSync, fsyncSync, ftruncateSync, openSync, readSync, writeSync } from "node:fs";
import { join } from "node:path";
import { type Entry, entry, line, readEntries, replay } from "../run/journal.ts";
import { type RunEvent, type RunState, next } from "../run/machine.ts";

export const JOURNAL_FILE = "journal.jsonl";

const journalFile = (runDir: string) => join(runDir, JOURNAL_FILE);

/** A run's journal as text, from byte `offset` on; undefined when its process hasn't started it yet. */
function readText(runDir: string, offset = 0): string | undefined {
  let descriptor: number;
  try { descriptor = openSync(journalFile(runDir), "r"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const bytes = Buffer.alloc(Math.max(0, fstatSync(descriptor).size - offset));
    let read = 0;
    for (let more = -1; more !== 0 && read < bytes.length; read += more) more = readSync(descriptor, bytes, read, bytes.length - read, offset + read);
    return bytes.toString("utf8", 0, read);
  } finally { closeSync(descriptor); }
}

/** The entries of a run, as far as they are written. */
export const readJournal = (runDir: string): Entry[] => readEntries(readText(runDir) ?? "").entries;

/** Reads the entries that were added since the last call. */
export function journalReader(runDir: string): () => Entry[] {
  let offset = 0;
  return () => {
    const text = readText(runDir, offset) ?? "";
    const { entries, length } = readEntries(text);
    offset += Buffer.byteLength(text.slice(0, length));
    return entries;
  };
}

export interface Journal {
  /** The run's state: the entries applied in order. */
  readonly state: RunState;
  /** Adds an event. It is on the disk when this returns; one that can't happen to the run throws, and isn't added. */
  append(event: RunEvent): Entry;
  close(): void;
}

/**
 * Opens a run's journal to write it; only the run's owner may. A journal that isn't there is started, and a line that was
 * cut short is removed.
 */
export function openJournal(runDir: string, now: () => Date = () => new Date()): Journal {
  const text = readText(runDir) ?? "";
  const { entries, length } = readEntries(text);
  let state = replay(entries);
  let end = Buffer.byteLength(text.slice(0, length));
  const descriptor = openSync(journalFile(runDir), constants.O_RDWR | constants.O_CREAT);
  ftruncateSync(descriptor, end);
  const append = (event: RunEvent): Entry => {
    const after = next(state, event);
    const added = entry(event, now());
    const bytes = Buffer.from(line(added));
    for (let written = 0; written < bytes.length; ) written += writeSync(descriptor, bytes, written, bytes.length - written, end + written);
    // What a phase says while it works may be lost in a power cut; what changes the run's state may not.
    if (event.type !== "progress") fsyncSync(descriptor);
    end += bytes.length;
    state = after;
    return added;
  };
  if (!state) append({ type: "created" });
  return { get state() { return state!; }, append, close() { closeSync(descriptor); } };
}

// The runs on this computer, indexed (epic GH-107 decision 031): what listing them needs, so that a long history doesn't mean
// reading every journal. The journals are the truth; a missing, older or damaged index is made again from them.
import { rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { type RunState, isEnded } from "../run/machine.ts";
import { JOURNAL_FILE, readJournal } from "./journal.ts";
import { runState } from "./owner.ts";
import { readRunIn, runNumbersIn, runsDir } from "./run-folder.ts";
import { isBusy, openDatabase } from "./sqlite.ts";

export interface Tracked {
  number: number;
  /** The run's folder. */
  dir: string;
  script: string;
  startedAt: string;
  endedAt?: string;
  state: RunState;
}

const VERSION = 1;
const FILE = "tracker.db";
const WAIT_MS = 2000;

/** The index, or undefined when it can't be used now: nothing depends on it. */
function open(data: string): DatabaseSync | undefined {
  const file = join(data, FILE);
  for (const last of [false, true]) {
    let db: DatabaseSync | undefined;
    try {
      db = openDatabase(file, WAIT_MS);
      const { user_version: version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
      if (version !== VERSION) {
        db.exec(`BEGIN IMMEDIATE; DROP TABLE IF EXISTS runs;
          CREATE TABLE runs (workspace TEXT, number INTEGER, journal_bytes INTEGER, summary TEXT, PRIMARY KEY (workspace, number)) WITHOUT ROWID;
          PRAGMA user_version = ${VERSION}; COMMIT`);
      }
      // A damaged file is found here rather than at some later row.
      const { quick_check: check } = db.prepare("PRAGMA quick_check(1)").get() as { quick_check: string };
      if (check !== "ok") throw new Error(check);
      db.prepare("SELECT workspace, number, journal_bytes, summary FROM runs LIMIT 1").get();
      return db;
    } catch (error) {
      db?.close();
      if (last || isBusy(error)) return undefined;
      try { for (const suffix of ["", "-journal"]) rmSync(`${file}${suffix}`, { force: true }); } catch { return undefined; }
    }
  }
}

/** A workspace's runs, newest first. One whose process hasn't started isn't a run yet. */
export function trackedRuns(data: string, workspaceId: string): Tracked[] {
  const runs = runsDir(data, workspaceId);
  const numbers = runNumbersIn(runs);
  if (!numbers.length) return [];
  const db = open(data);
  try {
    const known = new Map((db?.prepare("SELECT number, journal_bytes, summary FROM runs WHERE workspace = ?").all(workspaceId) ?? [])
      .map((row) => [row.number as number, row as { journal_bytes: number; summary: string }]));
    return numbers.flatMap((number): Tracked[] => {
      const dir = join(runs, String(number));
      const bytes = statSync(join(dir, JOURNAL_FILE), { throwIfNoEntry: false })?.size;
      if (bytes === undefined) return [];
      const row = known.get(number);
      if (row?.journal_bytes === bytes) return [{ ...JSON.parse(row.summary) as Omit<Tracked, "number" | "dir">, number, dir }];
      const run = readRunIn(dir);
      const state = run && runState(dir);
      if (!state) return [];
      const journal = readJournal(dir);
      const summary: Omit<Tracked, "number" | "dir"> = { script: run.request.script.name, startedAt: run.request.startedAt,
        ...(isEnded(state) ? { endedAt: journal.at(-1)!.at } : {}), state };
      // Only what can't change by itself: a run that is going can die without a word. The size from before it was read: a
      // journal that has grown since is read again.
      if (isEnded(state)) keep(db, workspaceId, number, bytes, JSON.stringify(summary));
      return [{ ...summary, number, dir }];
    });
  } finally { db?.close(); }
}

function keep(db: DatabaseSync | undefined, ...row: [string, number, number, string]): void {
  try { db?.prepare("INSERT OR REPLACE INTO runs (workspace, number, journal_bytes, summary) VALUES (?, ?, ?, ?)").run(...row); }
  catch { /* the index is busy or full; the journal is there */ }
}

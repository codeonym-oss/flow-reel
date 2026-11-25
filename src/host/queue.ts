// Turns at heavy work on this computer (GH-108 decision 009): a recording, a render or a local voice at a time, in the
// order they were asked for.
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Phase } from "../run/phases.ts";
import { KNOWN, type Settings } from "../settings.ts";
import { isOwned } from "./owner.ts";
import { dataOf } from "./run-folder.ts";
import { runId } from "./runs.ts";
import { openDatabase } from "./sqlite.ts";

/** Whether a phase is heavy work: a cloud voice, planning and publishing aren't. */
export const isHeavy = (phase: Phase, { voice }: Settings): boolean =>
  phase === "record" || phase === "render" || (phase === "voice" && !KNOWN.voices[voice.adapter].cloud);

const WRITE_MS = 5000;
const POLL_MS = 250;

/**
 * Waits for a run's turn, and returns what ends it. `behind` is called with the run it waits for, again when that changes.
 * The run's process must own it: the turn of a run that nobody owns is skipped.
 */
export async function takeTurn(runDir: string, behind: (run: string) => void, signal: AbortSignal): Promise<() => void> {
  signal.throwIfAborted();
  const db = openDatabase(join(dataOf(runDir), "queue.db"), WRITE_MS);
  db.exec("CREATE TABLE IF NOT EXISTS turns (number INTEGER PRIMARY KEY AUTOINCREMENT, run TEXT NOT NULL)");
  db.prepare("DELETE FROM turns WHERE run = ?").run(runDir); // of a process of this run that died
  const { lastInsertRowid: mine } = db.prepare("INSERT INTO turns (run) VALUES (?)").run(runDir);
  const end = () => {
    db.prepare("DELETE FROM turns WHERE number = ?").run(mine);
    db.close();
  };
  try {
    for (let last: string | undefined; ; ) {
      const before = db.prepare("SELECT number, run FROM turns WHERE number < ? ORDER BY number").all(mine) as { number: number; run: string }[];
      const first = before.find(({ number, run }) => {
        if (isOwned(run)) return true;
        db.prepare("DELETE FROM turns WHERE number = ?").run(number);
        return false;
      });
      if (!first) return end;
      if (first.run !== last) behind(runId(first.run));
      last = first.run;
      await sleep(POLL_MS, undefined, { signal });
    }
  } catch (error) {
    end();
    throw error;
  }
}

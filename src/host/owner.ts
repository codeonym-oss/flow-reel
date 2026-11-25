// A run's owner: the one process that drives it, holding its lock for as long as it lives (GH-108 decision 016).
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Entry, replay } from "../run/journal.ts";
import { type RunState, isEnded, next } from "../run/machine.ts";
import { listen } from "./control.ts";
import { type Driver, type Work, drive } from "./driver.ts";
import { journalReader, openJournal, readJournal } from "./journal.ts";
import { isLocked, takeLock } from "./lock.ts";
import { whatNext } from "./resume.ts";
import type { Run } from "./run-folder.ts";

const LOCK_FILE = "owner.lock";
/** How long an owner waits for a client that is recording that the run's last owner died. */
const TAKE_MS = 5000;

const lockFile = (runDir: string) => join(runDir, LOCK_FILE);

/** Whether a process owns a run. */
export const isOwned = (runDir: string): boolean => isLocked(lockFile(runDir));

/** Does something to a run that nobody owns, and keeps it so meanwhile; false when a process owns it. */
export async function whileUnowned(runDir: string, work: () => Promise<boolean>): Promise<boolean> {
  const lock = takeLock(lockFile(runDir));
  if (!lock) return false;
  try { return await work(); }
  finally { lock.release(); }
}

/** Owns a run until it ends: drives it, and takes commands for it. `started` is called once it does. */
export async function ownRun(run: Run, work: Work, started: () => void = () => {}): Promise<RunState> {
  const lock = takeLock(lockFile(run.dir), TAKE_MS);
  if (!lock) throw new Error("another process is running it");
  try {
    const last = replay(readJournal(run.dir));
    const lost = last && await whatNext(run, last, "contents");
    if (lost && "lost" in lost) throw new Error(lost.lost);
    let driver: Driver | undefined;
    const control = await listen(run.dir, (command) => {
      if (!driver) throw new Error("it is starting");
      driver.control({ type: command });
    });
    try {
      driver = drive(run, work);
      started();
      return await driver.ended;
    } finally { control.close(); }
  } finally { lock.release(); }
}

/** The state of a run: undefined when its process hasn't started. One whose process is gone is recorded as stopped first. */
export function runState(runDir: string): RunState | undefined {
  const state = replay(readJournal(runDir));
  return state && !isEnded(state) && settle(runDir) ? replay(readJournal(runDir)) : state;
}

/** Records that a run stopped when its owner is gone; false when it has one. */
function settle(runDir: string): boolean {
  if (isOwned(runDir)) return false;
  const lock = takeLock(lockFile(runDir));
  if (!lock) return false;
  try {
    const journal = openJournal(runDir);
    try { if (!isEnded(journal.state)) journal.append({ type: "stopped", reason: "its process ended" }); }
    finally { journal.close(); }
    return true;
  } finally { lock.release(); }
}

const POLL_MS = 200;
/** How many polls without news before asking whether the owner still lives. */
const QUIET_POLLS = 5;

/** A run's entries as they are added, from its first, until it has ended. */
export async function* follow(runDir: string, signal?: AbortSignal): AsyncGenerator<Entry> {
  const read = journalReader(runDir);
  let state: RunState | undefined;
  for (let quiet = 0; ; ) {
    const entries = read();
    for (const entry of entries) {
      state = next(state, entry);
      yield entry;
    }
    if (state && isEnded(state)) return;
    quiet = entries.length ? 0 : quiet + 1;
    if (state && quiet >= QUIET_POLLS && settle(runDir)) quiet = 0;
    await sleep(POLL_MS, undefined, { signal });
  }
}

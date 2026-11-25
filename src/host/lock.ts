// A lock the operating system releases when its holder dies, however it dies (GH-108 decision 016): SQLite's lock on an
// empty file. Nothing else may open that file: on Unix, closing any descriptor of it drops the lock.
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { isBusy, openDatabase } from "./sqlite.ts";

export interface Lock { release(): void }

/** Takes a file's lock, waiting up to `waitMs`; undefined when another process holds it. */
export function takeLock(file: string, waitMs = 0): Lock | undefined {
  const db = openDatabase(file, waitMs);
  try { db.exec("BEGIN EXCLUSIVE"); }
  catch (error) {
    db.close();
    if (isBusy(error)) return undefined;
    throw error;
  }
  return { release() { db.close(); } };
}

/** Takes a file's lock once it is free, without keeping this process from doing anything else. */
export async function waitForLock(file: string, signal?: AbortSignal): Promise<Lock> {
  for (;;) {
    signal?.throwIfAborted();
    const lock = takeLock(file);
    if (lock) return lock;
    await sleep(100, undefined, { signal });
  }
}

/** Whether a file's lock is held. Asking doesn't take it, so any number of processes can ask at once. */
export function isLocked(file: string): boolean {
  if (!existsSync(file)) return false;
  const db = openDatabase(file);
  try {
    db.exec("SELECT 1 FROM sqlite_schema");
    return false;
  } catch (error) {
    if (isBusy(error)) return true;
    throw error;
  } finally { db.close(); }
}

// Puts a run's reel in its place, never over a newer run's (GH-108 decision 010).
import { dirname, join } from "node:path";
import { folderStore } from "../adapters/folder/store.ts";
import type { Published } from "./driver.ts";
import { readJournal } from "./journal.ts";
import { waitForLock } from "./lock.ts";
import { type Run, readRunIn, runNumbersIn } from "./run-folder.ts";

/** The newest run started after this one that has published its reel to the same place, or has begun to. */
function newerRun(run: Run): number | undefined {
  const runs = dirname(run.dir);
  return runNumbersIn(runs).find((number) => {
    if (number <= run.number) return false;
    const other = readRunIn(join(runs, String(number)));
    // Its journal says so before it touches the reel, so a run that looks with the lock held can't miss it.
    return other?.request.reel === run.request.reel && readJournal(other.dir).some((entry) => entry.type === "phase-started" && entry.phase === "publish");
  });
}

/** Publishes the reel in the folder `built`, unless a newer run has taken its place. */
export async function publishReel(run: Run, built: string, signal?: AbortSignal): Promise<Published> {
  const { reel } = run.request;
  const lock = await waitForLock(join(dirname(dirname(run.dir)), "publish.lock"), signal);
  try {
    const newer = newerRun(run);
    if (newer !== undefined) return { reel: built, newer };
    await folderStore.publish(built, reel);
    return { reel };
  } finally { lock.release(); }
}

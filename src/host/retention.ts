// How much of a run is kept once it is finished (GH-108 decision 004): its history always, its heavy files for the last few
// runs of its script. A run that is going, or can go on, keeps everything.
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { isEnded } from "../run/machine.ts";
import { RESULTS } from "../run/phases.ts";
import { listFiles } from "./files.ts";
import { JOURNAL_FILE } from "./journal.ts";
import { runState, whileUnowned } from "./owner.ts";
import { whatNext } from "./resume.ts";
import { type Run, dataOf, readRunIn, runsDir } from "./run-folder.ts";
import { type Tracked, trackedRuns } from "./tracker.ts";

/** Everything of a run but its request, its journal and its log. */
const HEAVY = ["scripts", "previous", "reel", ...RESULTS];
const heavyDirs = (dir: string) => HEAVY.flatMap((name) => [name, `${name}.tmp`]).map((name) => join(dir, name)).filter((path) => existsSync(path));

export const hasHeavyFiles = (dir: string): boolean => heavyDirs(dir).length > 0;
export const heavyBytes = (dir: string): number => heavyDirs(dir).flatMap((path) => listFiles(path).map((file) => statSync(join(path, file)).size))
  .reduce((sum, bytes) => sum + bytes, 0);

/** Whether a run ended and has nothing to go on with. */
async function isFinished({ dir, state }: Pick<Tracked, "dir" | "state">): Promise<boolean> {
  if (!isEnded(state)) return false;
  const run = readRunIn(dir);
  const next = run && await whatNext(run, state);
  return next === undefined || "lost" in next;
}

/** Removes a finished run's heavy files; false when it isn't finished any more. */
export function removeHeavyFiles(dir: string): Promise<boolean> {
  return whileUnowned(dir, async () => {
    const state = runState(dir);
    if (!state || !await isFinished({ dir, state })) return false;
    for (const path of heavyDirs(dir)) rmSync(path, { recursive: true, force: true, maxRetries: 3 });
    return true;
  });
}

/** A workspace's finished runs that still have heavy files, newest first. */
export async function finishedRuns(data: string, workspaceId: string): Promise<Tracked[]> {
  const finished: Tracked[] = [];
  for (const run of trackedRuns(data, workspaceId)) if (hasHeavyFiles(run.dir) && await isFinished(run)) finished.push(run);
  return finished;
}

/**
 * Trims the finished runs of a run's script: the last `keepRuns` that are done keep their files, and as many of the others,
 * so that cancelling runs doesn't cost the files of the ones that worked.
 */
export async function trim({ dir, request: { workspace, script, keepRuns: keep } }: Run): Promise<void> {
  const runs = (await finishedRuns(dataOf(dir), workspace.id)).filter((run) => run.script === script.name)
    .sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!));
  const done = runs.filter(({ state }) => state.state === "done");
  const others = runs.filter(({ state }) => state.state !== "done");
  for (const { dir } of [...done.slice(keep), ...others.slice(keep)]) await removeHeavyFiles(dir);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Folders of runs that were never started, left by a command that was killed. */
export function leftovers(data: string, workspaceId: string): string[] {
  const runs = runsDir(data, workspaceId);
  if (!existsSync(runs)) return [];
  return readdirSync(runs).map((name) => join(runs, name))
    .filter((dir) => !existsSync(join(dir, JOURNAL_FILE)) && Date.now() - statSync(dir).mtimeMs > DAY_MS);
}

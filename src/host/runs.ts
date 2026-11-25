// Finds runs by the names a person uses (GH-108 decision 008, GH-116 decision 003): a run's number in this workspace, a
// workspace and a number, or a script, which means its latest run.
import { basename, dirname } from "node:path";
import type { RunState } from "../run/machine.ts";
import type { Workspace } from "../workspace/workspace.ts";
import { type KnownWorkspace, knownWorkspaces, localSlug } from "./data.ts";
import { runState } from "./owner.ts";
import { type Run, readRun, readRunIn } from "./run-folder.ts";
import { trackedRuns } from "./tracker.ts";

export interface FoundRun {
  /** `shop/12`. */
  id: string;
  run: Run;
  state: RunState;
}

/** The id of the run in a folder. */
export function runId(runDir: string): string {
  const workspace = dirname(dirname(runDir));
  const known = knownWorkspaces(dirname(dirname(workspace))).find(({ id }) => id === basename(workspace));
  return `${known ? localSlug(known) : basename(workspace)}/${basename(runDir)}`;
}

const NUMBER = /^[1-9]\d*$/;

/** A workspace's runs, newest first. One whose process hasn't started isn't a run yet. */
export function* workspaceRuns(data: string, known: KnownWorkspace): Generator<FoundRun> {
  for (const { number, state, dir } of trackedRuns(data, known.id)) {
    const run = readRunIn(dir);
    if (run) yield { id: `${localSlug(known)}/${number}`, run, state };
  }
}

function read(data: string, known: KnownWorkspace, number: number): FoundRun | undefined {
  const run = readRun(data, known.id, number);
  const state = run && runState(run.dir);
  return state && { id: `${localSlug(known)}/${number}`, run, state };
}

/**
 * The runs a name means: one for a number, every run of a script, newest first, for its name. `here` is the workspace the
 * command is in, if it is in one.
 */
export function findRuns(data: string, name: string, here: () => Workspace): FoundRun[] {
  const slash = name.lastIndexOf("/");
  if (slash > 0 && NUMBER.test(name.slice(slash + 1))) {
    const known = knownWorkspaces(data).find((known) => localSlug(known) === name.slice(0, slash));
    if (known) return one(read(data, known, Number(name.slice(slash + 1))), name);
  }
  const { id } = here().config.workspace;
  const known = knownWorkspaces(data).find((known) => known.id === id);
  if (known && NUMBER.test(name)) return one(read(data, known, Number(name)), name);
  const runs = known ? [...workspaceRuns(data, known)].filter(({ run }) => run.request.script.name === name) : [];
  if (!runs.length) throw new Error(`there is no run of ${JSON.stringify(name)} in this workspace`);
  return runs;
}

function one(found: FoundRun | undefined, name: string): FoundRun[] {
  if (!found) throw new Error(`there is no run ${name}`);
  return [found];
}

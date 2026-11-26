// The run a command's argument names.
import { dataDir } from "../host/data.ts";
import { type FoundRun, findRuns } from "../host/runs.ts";
import { isEnded } from "../run/machine.ts";
import { findWorkspace } from "../workspace/workspace.ts";

const find = (name: string): FoundRun[] => findRuns(dataDir(), name, () => findWorkspace(process.cwd()));

/** The run an id names, or a script's latest. */
export const latestRun = (name: string): FoundRun => find(name)[0];

/** The one run a name means that `fits`; refused when several do, because the command changes it (GH-108 decision 008). */
export async function theRun(name: string, fits: (found: FoundRun) => boolean | Promise<boolean>, none: (latest: FoundRun) => string | Promise<string>): Promise<FoundRun> {
  const runs = find(name);
  const fitting: FoundRun[] = [];
  for (const run of runs) if (await fits(run)) fitting.push(run);
  if (fitting.length > 1) throw new Error(`${JSON.stringify(name)} means ${fitting.length} runs: name one of ${fitting.map(({ id }) => id).join(", ")}`);
  if (!fitting.length) throw new Error(await none(runs[0]));
  return fitting[0];
}

export const isGoing = ({ state }: FoundRun): boolean => !isEnded(state);

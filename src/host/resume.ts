// What can be done with a run that ended (GH-108 decision 007), worked out from what it left.
import type { RunState } from "../run/machine.ts";
import { type Phase, RESULTS } from "../run/phases.ts";
import { resultProblem } from "./results.ts";
import type { Run } from "./run-folder.ts";

export type Next =
  /** It can go on, from this phase. */
  | { resume: Phase }
  /** It can't, and why. */
  | { lost: string };

/** Undefined for a run that hasn't ended, is done, or was cancelled: there is nothing to go on with. */
export async function whatNext(run: Run, state: RunState, check: "sizes" | "contents" = "sizes"): Promise<Next | undefined> {
  if (state.state !== "stopped" && state.state !== "failed") return undefined;
  for (const phase of RESULTS) {
    const problem = await resultProblem(run.dir, phase, check);
    // Nothing else repeats what the script did (decision 006).
    if (problem && phase === "record") return { lost: "recording lost" };
    if (problem) return { resume: phase };
  }
  return { resume: "publish" };
}

// Drives a run to its end: asks the state machine what comes next, does it, and records what happened in the journal. It
// is the only thing that writes the journal (epic GH-107 decision 031).
import type { Entry } from "../run/journal.ts";
import { type RunEvent, type RunState, isEnded, todo } from "../run/machine.ts";
import { type Phase, RESULTS, type ResultPhase } from "../run/phases.ts";
import type { PhaseHooks } from "./container.ts";
import { type Journal, openJournal } from "./journal.ts";
import { resultProblem } from "./results.ts";
import type { Run } from "./run-folder.ts";

/** What a client can ask of a run. */
export type Control = Extract<RunEvent, { type: "hold" | "step" | "release" | "cancel" }>;

export interface Work {
  /** Runs one phase whose inputs are ready, and keeps its result; rejects when it fails or `signal` aborts it. */
  phase(phase: Phase, hooks: PhaseHooks): Promise<void>;
  /** A line for the run's log. */
  log(line: string): void;
  /** Everything added to the journal, and the state it led to. */
  added?(entry: Entry, state: RunState): void;
}

export interface Driver {
  /** Passes a client's request on to the run; throws when the run can't take it. */
  control(event: Control): void;
  /** The state the run ended in. */
  ended: Promise<RunState>;
}

const hasResult = (phase: Phase): phase is ResultPhase => (RESULTS as readonly Phase[]).includes(phase);

/** Drives the run from where its journal says it is. */
export function drive(run: Run, work: Work): Driver {
  const journal: Journal = openJournal(run.dir);
  const cancelled = new AbortController();
  let wake = () => {};
  const append = (event: RunEvent) => {
    const entry = journal.append(event);
    work.added?.(entry, journal.state);
  };

  async function runPhase(phase: Phase): Promise<void> {
    // A run that goes on keeps the results that still hold.
    if (hasResult(phase) && await resultProblem(run.dir, phase) === undefined) return append({ type: "phase-finished", phase, reused: true });
    append({ type: "phase-started", phase });
    try {
      await work.phase(phase, { signal: cancelled.signal, log: work.log, report: (what) => append({ type: "progress", phase, what }) });
    } catch (error) {
      if (journal.state.cancelling) return append({ type: "cancelled" });
      work.log(String((error as Error).stack ?? error));
      return append({ type: "failed", phase, message: (error as Error).message });
    }
    append({ type: "phase-finished", phase });
  }

  async function toTheEnd(): Promise<RunState> {
    try {
      while (!isEnded(journal.state)) {
        const next = todo(journal.state);
        switch (next.do) {
          case "phase": await runPhase(next.phase); break;
          case "hold": append({ type: "held", gate: next.gate }); break;
          case "cancel": append({ type: "cancelled" }); break;
          case "finish": append({ type: "done", reel: run.request.reel, published: true }); break;
          case "wait": await new Promise<void>((resolve) => { wake = resolve; }); break;
        }
      }
      return journal.state;
    } finally { journal.close(); }
  }

  return {
    control(event) {
      append(event);
      if (event.type === "cancel") cancelled.abort(new Error("the run was cancelled"));
      wake();
    },
    ended: toTheEnd(),
  };
}

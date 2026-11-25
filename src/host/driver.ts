// Drives a run to its end: asks the state machine what comes next, does it, and records what happened in the journal. It
// is the only thing that writes the journal (epic GH-107 decision 031).
import type { Entry } from "../run/journal.ts";
import { type RunEvent, type RunState, isEnded, todo } from "../run/machine.ts";
import { type LimitedPhase, limitMs, overLimit } from "../workspace/limits.ts";
import { type Phase, RESULTS, type ResultPhase } from "../run/phases.ts";
import type { PhaseHooks } from "./container.ts";
import { type Journal, openJournal } from "./journal.ts";
import { resultProblem } from "./results.ts";
import type { Run } from "./run-folder.ts";

/** What a client can ask of a run. */
export type Control = Extract<RunEvent, { type: "hold" | "step" | "release" | "cancel" }>;

/** Where publishing left the reel, and the newer run whose reel is in its place, when one is. */
export interface Published { reel: string; newer?: number }

export interface Work {
  /** Runs one phase whose inputs are ready, and keeps its result; rejects when it fails or `signal` aborts it. */
  phase(phase: Phase, hooks: PhaseHooks): Promise<Published | void>;
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

/** Drives the run from where its journal says it is; one that ended goes on, if it can. */
export function drive(run: Run, work: Work): Driver {
  const journal: Journal = openJournal(run.dir);
  if (isEnded(journal.state)) journal.append({ type: "resumed" });
  const cancelled = new AbortController();
  const { limits } = run.request;
  let wake = () => {};
  let reel: Published = { reel: run.request.reel };
  const append = (event: RunEvent) => {
    const entry = journal.append(event);
    work.added?.(entry, journal.state);
  };

  async function runPhase(phase: Phase): Promise<void> {
    // A run that goes on keeps the results that still hold.
    if (hasResult(phase) && await resultProblem(run.dir, phase) === undefined) return append({ type: "phase-finished", phase, reused: true });
    append({ type: "phase-started", phase });
    const over = new AbortController();
    const limit = limitMs(limits, phase);
    const timer = limit === undefined ? undefined : setTimeout(() => over.abort(new Error(overLimit(limits, phase as LimitedPhase))), limit);
    try {
      const done = await work.phase(phase, { signal: AbortSignal.any([cancelled.signal, over.signal]), log: work.log, report: (what) => append({ type: "progress", phase, what }) });
      if (done) reel = done;
    } catch (error) {
      if (journal.state.cancelling) return append({ type: "cancelled" });
      work.log(String((error as Error).stack ?? error));
      return append({ type: "failed", phase, message: (error as Error).message });
    } finally { clearTimeout(timer); }
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
          case "finish": append({ type: "done", ...reel }); break;
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

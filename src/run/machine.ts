// A run as a state machine (epic GH-107 decision 031): `next` is the only thing that changes a run's state, and `todo` the
// only thing that says what its driver does. Both are pure.
import { PHASES, type Phase } from "./phases.ts";

export const STATES = ["queued", "running", "held", "stopped", "failed", "done", "cancelled"] as const;
export type State = typeof STATES[number];

/** A named point where a run can be held: before a phase, or before a step of the script being recorded. */
export type Gate = { before: "phase"; phase: Phase } | { before: "step"; step: number };

/** What happens to a run, as its journal keeps it. */
export type RunEvent =
  /** The run exists. */
  | { type: "created" }
  /** It waits for its turn to do heavy work: a recording, a render or a local voice. */
  | { type: "waiting"; phase: Phase; behind?: string }
  | { type: "phase-started"; phase: Phase }
  /** What a phase says while it works; it changes no state. */
  | { type: "progress"; phase: Phase; what: Progress }
  /** The phase's result is complete, or an earlier one still holds. */
  | { type: "phase-finished"; phase: Phase; reused?: true }
  /** A client asked the run to hold at the next gate. */
  | { type: "hold" }
  | { type: "held"; gate: Gate }
  /** A client let a held run go on: to the next gate, or on. */
  | { type: "step" }
  | { type: "release" }
  /** A client asked the run to end. */
  | { type: "cancel" }
  | { type: "cancelled" }
  /** Something went wrong in the script, the app, the voice or the render. */
  | { type: "failed"; phase: Phase; message: string }
  /** It ended without an error and without finishing: its process died, or nobody came (decision 007). */
  | { type: "stopped"; reason: StopReason }
  /** The reel is complete; `published` is false when a newer run's reel is in its place (decision 010). */
  | { type: "done"; reel: string; published: boolean }
  /** A person asked an ended run to go on. */
  | { type: "resumed" };

/** What the engine keeps of a phase's progress is up to the phase. */
export interface Progress { type: string; [key: string]: unknown }

export type StopReason = "its process ended" | "nobody came";

export interface RunState {
  state: State;
  /** The phase being run. */
  phase?: Phase;
  /** The phases that are finished, in order. */
  finished: readonly Phase[];
  /** A client wants the run held at the next gate. */
  holding: boolean;
  /** Where a held run is held, and the state it goes back to. */
  held?: { gate: Gate; from: "queued" | "running" };
  /** The phase it was let start after being held before it: it isn't held there twice. */
  passed?: Phase;
  /** A client asked the run to end; its driver is ending it. */
  cancelling: boolean;
  /** The phase it waits to start, and what it waits behind. */
  waiting?: { phase: Phase; behind?: string };
  /** Why it ended, unless it is done. */
  ended?: { phase?: Phase; message: string };
  /** The finished reel. */
  reel?: { path: string; published: boolean };
}

/** The states a run doesn't leave by itself. */
export const isEnded = ({ state }: Pick<RunState, "state">): boolean =>
  state === "stopped" || state === "failed" || state === "done" || state === "cancelled";

/** The phase after the ones that are finished. */
export const nextPhase = ({ finished }: Pick<RunState, "finished">): Phase | undefined => PHASES[finished.length];

export class IllegalEvent extends Error {
  constructor(run: RunState | undefined, event: RunEvent, why: string) {
    super(`a ${run ? `${run.state} run` : "run that doesn't exist"} can't take ${JSON.stringify(event.type)}: ${why}`);
  }
}

/** The state of a run after an event; throws an IllegalEvent when the event can't happen to it. */
export function next(run: RunState | undefined, event: RunEvent): RunState {
  const refuse = (why: string): never => { throw new IllegalEvent(run, event, why); };
  if (run === undefined) {
    return event.type === "created" ? { state: "queued", finished: [], holding: false, cancelling: false } : refuse("it wasn't created");
  }
  if (event.type === "created") return refuse("it was created already");
  if (event.type === "resumed") {
    if (run.state !== "stopped" && run.state !== "failed") return refuse("only a stopped or failed run can go on");
    return { state: "queued", finished: [], holding: false, cancelling: false };
  }
  if (isEnded(run)) return refuse("it has ended");
  const { waiting: _, ...rest } = run;
  switch (event.type) {
    case "waiting":
      if (run.state === "held") return refuse("it is held");
      if (run.phase) return refuse(`it is in its ${run.phase} phase`);
      if (event.phase !== nextPhase(run)) return refuse(`its next phase is ${nextPhase(run) ?? "none"}`);
      return { ...rest, state: "queued", waiting: { phase: event.phase, ...(event.behind === undefined ? {} : { behind: event.behind }) } };
    case "phase-started":
      if (run.state === "held") return refuse("it is held");
      if (run.phase) return refuse(`it is in its ${run.phase} phase`);
      if (event.phase !== nextPhase(run)) return refuse(`its next phase is ${nextPhase(run) ?? "none"}`);
      return { ...started(rest), state: "running", phase: event.phase };
    case "progress":
      return event.phase === run.phase ? run : refuse(`it isn't in its ${event.phase} phase`);
    case "phase-finished": {
      const { phase, ...without } = rest;
      if (run.state === "held") return refuse("it is held");
      if (event.reused ? phase !== undefined || event.phase !== nextPhase(run) : event.phase !== phase) {
        return refuse(`it isn't ${event.reused ? "about to start" : "in"} its ${event.phase} phase`);
      }
      return { ...started(without), state: event.reused ? run.state : "running", finished: [...run.finished, event.phase] };
    }
    case "hold":
      if (run.state === "held") return refuse("it is held");
      return { ...run, holding: true };
    case "held": {
      if (run.state === "held") return refuse("it is held");
      if (!run.holding) return refuse("nobody asked it to hold");
      const { gate } = event;
      if (gate.before === "phase" ? run.phase !== undefined || gate.phase !== nextPhase(run) : run.phase !== "record") {
        return refuse("it isn't at that gate");
      }
      if (gate.before === "phase" && gate.phase === run.passed) return refuse("it was let through that gate");
      return { ...rest, state: "held", holding: false, held: { gate, from: run.state as "queued" | "running" } };
    }
    case "step": case "release": {
      if (run.state !== "held" || !run.held) return event.type === "release" && run.holding ? { ...run, holding: false } : refuse("it isn't held");
      const { held, ...without } = run;
      const { gate, from } = held;
      return { ...without, state: from, holding: event.type === "step", ...(gate.before === "phase" ? { passed: gate.phase } : {}) };
    }
    case "cancel":
      return run.cancelling ? refuse("it is being cancelled") : { ...run, cancelling: true };
    case "cancelled":
      return run.cancelling ? ended(run, "cancelled", "a person cancelled it") : refuse("nobody asked it to end");
    case "failed":
      return event.phase === run.phase ? ended(run, "failed", event.message) : refuse(`it isn't in its ${event.phase} phase`);
    case "stopped":
      return ended(run, "stopped", event.reason);
    case "done": {
      if (nextPhase(run)) return refuse(`its ${nextPhase(run)} phase isn't finished`);
      return { state: "done", finished: run.finished, holding: false, cancelling: false, reel: { path: event.reel, published: event.published } };
    }
  }
}

const started = <S extends { passed?: Phase }>({ passed: _, ...run }: S): Omit<S, "passed"> => run;

const ended = (run: RunState, state: "cancelled" | "failed" | "stopped", message: string): RunState =>
  ({ state, finished: run.finished, holding: false, cancelling: false, ended: { ...(run.phase ? { phase: run.phase } : {}), message } });

/** What a run's driver does next. */
export type Todo =
  | { do: "phase"; phase: Phase }
  | { do: "hold"; gate: Gate }
  | { do: "cancel" }
  | { do: "finish" }
  /** A phase is running, the run is held, or it has ended: wait for an event. */
  | { do: "wait" };

export function todo(run: RunState): Todo {
  if (isEnded(run)) return { do: "wait" };
  const phase = nextPhase(run);
  // Once its reel is in place it is done, even when it was asked to end a moment before.
  if (!phase) return { do: "finish" };
  if (run.cancelling) return { do: "cancel" };
  if (run.state === "held" || run.phase) return { do: "wait" };
  return run.holding && run.passed !== phase ? { do: "hold", gate: { before: "phase", phase } } : { do: "phase", phase };
}

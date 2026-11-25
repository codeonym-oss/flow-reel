import { describe, expect, it } from "vitest";
import { type Entry, entry, line, readEntries, replay } from "../../src/run/journal.ts";
import { IllegalEvent, type RunEvent, type RunState, STATES, isEnded, next, todo } from "../../src/run/machine.ts";
import { PHASES, type Phase } from "../../src/run/phases.ts";

const run = (...events: RunEvent[]): RunState => events.reduce<RunState | undefined>(next, undefined)!;
const through = (...phases: Phase[]): RunEvent[] => phases.flatMap((phase) => [{ type: "phase-started", phase }, { type: "phase-finished", phase }]);
const created: RunEvent = { type: "created" };
const recording: RunEvent[] = [created, { type: "phase-started", phase: "record" }];
const done: RunEvent = { type: "done", reel: "/out/a.reel" };

/** A run in each situation that takes events differently. */
const SITUATIONS: Record<string, RunState> = {
  "new": run(created),
  "waiting to record": run(created, { type: "waiting", phase: "record", behind: "shop#3" }),
  "asked to hold, before a phase": run(created, { type: "hold" }),
  "held before recording": run(created, { type: "hold" }, { type: "held", gate: { before: "phase", phase: "record" } }),
  "recording": run(...recording),
  "asked to hold, recording": run(...recording, { type: "hold" }),
  "held before a step": run(...recording, { type: "hold" }, { type: "held", gate: { before: "step", step: 2 } }),
  "cancelling": run(...recording, { type: "cancel" }),
  "held and cancelling": run(created, { type: "hold" }, { type: "held", gate: { before: "phase", phase: "record" } }, { type: "cancel" }),
  "recorded": run(created, ...through("record")),
  "published": run(created, ...through(...PHASES)),
  "stopped": run(...recording, { type: "stopped", reason: "its process ended" }),
  "failed": run(...recording, { type: "failed", phase: "record", message: "no button" }),
  "cancelled": run(...recording, { type: "cancel" }, { type: "cancelled" }),
  "done": run(created, ...through(...PHASES), done),
};

const EVENTS: Record<string, RunEvent> = {
  "created": created,
  "waiting record": { type: "waiting", phase: "record" },
  "waiting voice": { type: "waiting", phase: "voice" },
  "start record": { type: "phase-started", phase: "record" },
  "start voice": { type: "phase-started", phase: "voice" },
  "progress record": { type: "progress", phase: "record", what: { type: "step", index: 0 } },
  "progress voice": { type: "progress", phase: "voice", what: { type: "voiced" } },
  "finish record": { type: "phase-finished", phase: "record" },
  "finish voice": { type: "phase-finished", phase: "voice" },
  "reuse record": { type: "phase-finished", phase: "record", reused: true },
  "reuse voice": { type: "phase-finished", phase: "voice", reused: true },
  "hold": { type: "hold" },
  "held before record": { type: "held", gate: { before: "phase", phase: "record" } },
  "held before voice": { type: "held", gate: { before: "phase", phase: "voice" } },
  "held before step": { type: "held", gate: { before: "step", step: 1 } },
  "step": { type: "step" },
  "release": { type: "release" },
  "cancel": { type: "cancel" },
  "cancelled": { type: "cancelled" },
  "fail record": { type: "failed", phase: "record", message: "x" },
  "fail voice": { type: "failed", phase: "voice", message: "x" },
  "stopped": { type: "stopped", reason: "nobody came" },
  "done": done,
  "resumed": { type: "resumed" },
};

/** Every event each situation takes, and the state it leads to. Whatever isn't here is refused. */
const TAKES: Record<string, Record<string, string>> = {
  "new": { "waiting record": "queued", "start record": "running", "reuse record": "queued", hold: "queued", cancel: "queued", stopped: "stopped" },
  "waiting to record": { "waiting record": "queued", "start record": "running", "reuse record": "queued", hold: "queued", cancel: "queued", stopped: "stopped" },
  "asked to hold, before a phase": { "waiting record": "queued", "start record": "running", "reuse record": "queued", hold: "queued",
    "held before record": "held", release: "queued", cancel: "queued", stopped: "stopped" },
  "held before recording": { step: "queued", release: "queued", cancel: "held", stopped: "stopped" },
  "recording": { "progress record": "running", "finish record": "running", hold: "running", cancel: "running", "fail record": "failed", stopped: "stopped" },
  "asked to hold, recording": { "progress record": "running", "finish record": "running", hold: "running", "held before step": "held",
    release: "running", cancel: "running", "fail record": "failed", stopped: "stopped" },
  "held before a step": { "progress record": "held", step: "running", release: "running", cancel: "held", "fail record": "failed", stopped: "stopped" },
  "cancelling": { "progress record": "running", "finish record": "running", hold: "running", cancelled: "cancelled", "fail record": "failed", stopped: "stopped" },
  "held and cancelling": { step: "queued", release: "queued", cancelled: "cancelled", stopped: "stopped" },
  "recorded": { "waiting voice": "queued", "start voice": "running", "reuse voice": "running", hold: "running", cancel: "running", stopped: "stopped" },
  "published": { hold: "running", cancel: "running", stopped: "stopped", done: "done" },
  "stopped": { resumed: "queued" },
  "failed": { resumed: "queued" },
  "cancelled": {},
  "done": {},
};

describe("the state machine", () => {
  for (const [situation, state] of Object.entries(SITUATIONS)) {
    it(`a run that is ${situation} takes these events, and refuses every other`, () => {
      const taken = Object.fromEntries(Object.entries(EVENTS).flatMap(([name, event]) => {
        try { return [[name, next(state, event).state]]; }
        catch (error) {
          expect(error).toBeInstanceOf(IllegalEvent);
          return [];
        }
      }));
      expect(taken).toEqual(TAKES[situation]);
    });
  }

  it("has a situation for every state, and takes only its creation before that", () => {
    expect(new Set(Object.values(SITUATIONS).map((s) => s.state))).toEqual(new Set(STATES));
    expect(() => next(undefined, { type: "cancel" })).toThrow("a run that doesn't exist can't take \"cancel\": it wasn't created");
    expect(() => next(SITUATIONS.recording, { type: "phase-started", phase: "voice" })).toThrow("a running run can't take \"phase-started\": it is in its record phase");
  });

  it("goes through the phases in order to a reel", () => {
    const state = SITUATIONS.done;
    expect(state).toEqual({ state: "done", finished: PHASES, holding: false, cancelling: false, reel: { path: "/out/a.reel" } });
    expect(Object.values(SITUATIONS).filter(isEnded).map((s) => s.state)).toEqual(["stopped", "failed", "cancelled", "done"]);
  });

  it("remembers why it ended, and in which phase", () => {
    expect(SITUATIONS.failed.ended).toEqual({ phase: "record", message: "no button" });
    expect(SITUATIONS.stopped.ended).toEqual({ phase: "record", message: "its process ended" });
    expect(run(created, { type: "stopped", reason: "nobody came" }).ended).toEqual({ message: "nobody came" });
  });

  it("goes back from a hold to where it was, and a step holds again at the next gate", () => {
    expect(next(SITUATIONS["held before recording"], { type: "release" })).toEqual({ ...SITUATIONS.new, passed: "record" });
    // The gate it was let through doesn't hold it again: the next one does.
    const past = next(SITUATIONS["held before recording"], { type: "step" });
    expect(todo(past)).toEqual({ do: "phase", phase: "record" });
    expect(() => next(past, { type: "held", gate: { before: "phase", phase: "record" } })).toThrow("let through");
    expect(todo(next(next(past, { type: "phase-started", phase: "record" }), { type: "phase-finished", phase: "record" })))
      .toEqual({ do: "hold", gate: { before: "phase", phase: "voice" } });
    const stepped = next(SITUATIONS["held before a step"], { type: "step" });
    expect(stepped).toMatchObject({ state: "running", phase: "record", holding: true });
    expect(next(stepped, { type: "held", gate: { before: "step", step: 3 } }).state).toBe("held");
    expect(next(SITUATIONS["held before a step"], { type: "release" })).toMatchObject({ state: "running", holding: false });
  });

  it("starts again after it ended, taking the results that still hold", () => {
    const resumed = run(created, ...through("record", "voice"), { type: "phase-started", phase: "plan" }, { type: "stopped", reason: "its process ended" }, { type: "resumed" });
    expect(resumed).toEqual({ state: "queued", finished: [], holding: false, cancelling: false });
    const reused = [{ type: "phase-finished", phase: "record", reused: true }, { type: "phase-finished", phase: "voice", reused: true }] satisfies RunEvent[];
    expect(todo(reused.reduce<RunState>(next, resumed))).toEqual({ do: "phase", phase: "plan" });
  });

  it("changes nothing it was given", () => {
    for (const state of Object.values(SITUATIONS)) {
      const frozen = structuredClone(state);
      for (const event of Object.values(EVENTS)) { try { next(state, event); } catch { /* refused */ } }
      expect(state).toEqual(frozen);
    }
  });
});

it("says what a run's driver does next", () => {
  expect(Object.fromEntries(Object.entries(SITUATIONS).map(([name, state]) => [name, todo(state)]))).toEqual({
    "new": { do: "phase", phase: "record" }, "waiting to record": { do: "phase", phase: "record" },
    "asked to hold, before a phase": { do: "hold", gate: { before: "phase", phase: "record" } }, "held before recording": { do: "wait" },
    "recording": { do: "wait" }, "asked to hold, recording": { do: "wait" }, "held before a step": { do: "wait" },
    "cancelling": { do: "cancel" }, "held and cancelling": { do: "cancel" },
    "recorded": { do: "phase", phase: "voice" }, "published": { do: "finish" },
    "stopped": { do: "wait" }, "failed": { do: "wait" }, "cancelled": { do: "wait" }, "done": { do: "wait" },
  });
});

describe("the journal", () => {
  const at = new Date("2026-11-25T20:00:00Z");
  const events: RunEvent[] = [created, { type: "phase-started", phase: "record" },
    { type: "progress", phase: "record", what: { type: "step", index: 0, comment: "Line\nbreak — é" } }, { type: "phase-finished", phase: "record" }];
  const text = events.map((event) => line(entry(event, at))).join("");

  it("reads back the events, with their version and time, and leads to the same state", () => {
    const { entries, length } = readEntries(text);
    expect(entries[2]).toEqual({ v: 1, at: "2026-11-25T20:00:00.000Z", ...events[2] });
    expect(length).toBe(text.length);
    expect(replay(entries)).toEqual(run(...events));
    expect(replay(entries.slice(2), replay(entries.slice(0, 2)))).toEqual(run(...events));
    expect(replay([])).toBeUndefined();
  });

  it("leaves out a last line that isn't complete", () => {
    for (const torn of ['{"v":1', '{"v":1,"at":"x","type":"cancel"}', "é"]) {
      expect(readEntries(text + torn)).toEqual({ entries: readEntries(text).entries, length: text.length });
    }
    expect(readEntries('{"v"')).toEqual({ entries: [], length: 0 });
  });

  it("refuses what it can't read, naming the line", () => {
    expect(() => readEntries(`${text}{\n`)).toThrow("the journal's line 5 isn't JSON");
    expect(() => readEntries('{"v":2,"type":"created"}\n')).toThrow("the journal's line 1 has version 2; this flow-reel reads version 1");
    expect(() => readEntries('{"v":1}\n')).toThrow("has no type");
    expect(() => replay([{ v: 1, at: "x", type: "cancelled" } as Entry])).toThrow(IllegalEvent);
  });
});

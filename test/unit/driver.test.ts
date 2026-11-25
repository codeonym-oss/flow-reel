import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { drive, type Work } from "../../src/host/driver.ts";
import { JOURNAL_FILE, openJournal, readJournal } from "../../src/host/journal.ts";
import type { Run } from "../../src/host/run-folder.ts";
import { replay } from "../../src/run/journal.ts";
import type { RunState } from "../../src/run/machine.ts";
import { PHASES, type Phase } from "../../src/run/phases.ts";
import { doPhase, folder, startRun } from "./runs.ts";

const working = (run: Run, work: Partial<Work> = {}): Work => ({ phase: (phase) => doPhase(run, phase), log() {}, ...work });
const types = (run: Run) => readJournal(run.dir).map((entry) => "phase" in entry && entry.phase ? `${entry.type} ${entry.phase}` : entry.type);
const read = (run: Run) => replay(readJournal(run.dir));

describe("a run's journal", () => {
  it("starts when the run's process does", async () => {
    const run = await startRun(folder());
    expect(readJournal(run.dir)).toEqual([]);
    openJournal(run.dir, () => new Date("2026-11-25T10:00:00Z")).close();
    expect(readJournal(run.dir)).toEqual([{ v: 1, at: "2026-11-25T10:00:00.000Z", type: "created" }]);
    expect(read(run)).toMatchObject({ state: "queued", finished: [] });
  });

  it("keeps events, and refuses one that can't happen without writing it", async () => {
    const run = await startRun(folder());
    const journal = openJournal(run.dir, () => new Date("2026-11-25T10:00:00Z"));
    journal.append({ type: "phase-started", phase: "record" });
    expect(() => journal.append({ type: "phase-finished", phase: "voice" })).toThrow("it isn't in its voice phase");
    journal.append({ type: "progress", phase: "record", what: { type: "step", index: 0, comment: "Voilà, é" } });
    journal.append({ type: "phase-finished", phase: "record" });
    journal.close();
    expect(types(run)).toEqual(["created", "phase-started record", "progress record", "phase-finished record"]);
    expect(readJournal(run.dir)[1].at).toBe("2026-11-25T10:00:00.000Z");
    expect(read(run)).toEqual(journal.state);
  });

  it("drops a line that was cut short, even inside a character, and goes on after it", async () => {
    const run = await startRun(folder());
    const journal = openJournal(run.dir);
    journal.append({ type: "phase-started", phase: "record" });
    journal.append({ type: "progress", phase: "record", what: { type: "step", index: 0, comment: "é" } });
    journal.close();
    const file = join(run.dir, JOURNAL_FILE);
    const cut = Buffer.from('{"v":1,"type":"progress","what":{"comment":"é');
    appendFileSync(file, cut.subarray(0, cut.length - 1));
    expect(types(run)).toEqual(["created", "phase-started record", "progress record"]);
    const again = openJournal(run.dir);
    again.append({ type: "phase-finished", phase: "record" });
    again.close();
    expect(types(run)).toEqual(["created", "phase-started record", "progress record", "phase-finished record"]);
  });

  it("isn't opened when it is damaged before its end", async () => {
    const run = await startRun(folder());
    writeFileSync(join(run.dir, JOURNAL_FILE), "not json\n");
    expect(() => openJournal(run.dir)).toThrow("the journal's line 1 isn't JSON");
  });
});

describe("driving a run", () => {
  it("does each phase in order, and the journal leads to the state it held", async () => {
    const run = await startRun(folder());
    const did: Phase[] = [];
    const states: RunState[] = [];
    const end = await drive(run, working(run, {
      async phase(phase, hooks) {
        did.push(phase);
        if (phase === "record") hooks.report({ type: "step", index: 0, comment: "Hello" });
        await doPhase(run, phase);
      },
      added: (_, state) => states.push(state),
    })).ended;
    expect(did).toEqual([...PHASES]);
    expect(end).toMatchObject({ state: "done", finished: [...PHASES], reel: { path: run.request.reel, published: true } });
    expect(types(run)).toEqual(["created", "phase-started record", "progress record", "phase-finished record",
      ...PHASES.slice(1).flatMap((phase) => [`phase-started ${phase}`, `phase-finished ${phase}`]), "done"]);
    expect(read(run)).toEqual(end);
    // At every moment, reading the journal gives the state the driver held.
    const entries = readJournal(run.dir);
    expect(states).toEqual(entries.slice(1).map((_, i) => replay(entries.slice(0, i + 2))));
  });

  it("ends failed, with the phase and what went wrong, and logs where", async () => {
    const run = await startRun(folder());
    const log: string[] = [];
    const end = await drive(run, working(run, { log: (line) => log.push(line),
      async phase(phase) { if (phase === "voice") throw new Error("no such speaker"); await doPhase(run, phase); } })).ended;
    expect(end).toMatchObject({ state: "failed", finished: ["record"], ended: { phase: "voice", message: "no such speaker" } });
    expect(read(run)).toEqual(end);
    expect(log.join("\n")).toContain("driver.test.ts");
  });

  it("is cancelled during a phase: the phase is ended first", async () => {
    const run = await startRun(folder());
    let ended = false;
    const driver = drive(run, working(run, { phase: (_, { signal }) => new Promise((_resolve, reject) => {
      signal!.addEventListener("abort", () => setTimeout(() => { ended = true; reject(signal!.reason as Error); }, 20));
      setTimeout(() => driver.control({ type: "cancel" }), 5);
    }) }));
    expect(await driver.ended).toMatchObject({ state: "cancelled", ended: { phase: "record" } });
    expect(ended).toBe(true);
    expect(types(run)).toEqual(["created", "phase-started record", "cancel", "cancelled"]);
    expect(() => driver.control({ type: "cancel" })).toThrow("it has ended");
  });

  it("is done when it is cancelled after its reel is in place", async () => {
    const run = await startRun(folder());
    const driver = drive(run, working(run, { async phase(phase) {
      await doPhase(run, phase);
      if (phase === "publish") driver.control({ type: "cancel" });
    } }));
    expect(await driver.ended).toMatchObject({ state: "done" });
  });

  it("holds before a phase when asked, steps to the next gate, and goes on when released", async () => {
    const run = await startRun(folder());
    const gates: string[] = [];
    const driver = drive(run, working(run, {
      async phase(phase) { if (phase === "record") driver.control({ type: "hold" }); await doPhase(run, phase); },
      added(entry) {
        if (entry.type !== "held") return;
        gates.push(entry.gate.before === "phase" ? entry.gate.phase : "step");
        setTimeout(() => driver.control({ type: entry.gate.before === "phase" && entry.gate.phase === "voice" ? "step" : "release" }), 5);
      },
    }));
    expect(await driver.ended).toMatchObject({ state: "done" });
    expect(gates).toEqual(["voice", "plan"]);
  });

  it("goes on after it failed, keeping the results that still hold", async () => {
    const run = await startRun(folder());
    await drive(run, working(run, { async phase(phase) { if (phase === "render") throw new Error("no disk space"); await doPhase(run, phase); } })).ended;
    const journal = openJournal(run.dir);
    journal.append({ type: "resumed" });
    journal.close();
    writeFileSync(join(run.dir, "plan/plan.txt"), "changed");
    const did: Phase[] = [];
    const end = await drive(run, working(run, { async phase(phase) { did.push(phase); await doPhase(run, phase); } })).ended;
    expect(end.state).toBe("done");
    expect(did).toEqual(["plan", "render", "publish"]);
    expect(types(run).slice(types(run).indexOf("resumed"))).toEqual(["resumed", "phase-finished record", "phase-finished voice",
      "phase-started plan", "phase-finished plan", "phase-started render", "phase-finished render", "phase-started publish", "phase-finished publish", "done"]);
    expect(readFileSync(join(run.dir, "plan/plan.txt"), "utf8")).toBe("plan");
  });
});

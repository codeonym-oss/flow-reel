// The history of the runs on this computer: the index, what is listed, what is kept (GH-120). Real processes, without containers.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { rememberWorkspace } from "../../src/host/data.ts";
import { openJournal } from "../../src/host/journal.ts";
import { takeLock } from "../../src/host/lock.ts";
import { finishedRuns, hasHeavyFiles, removeHeavyFiles, trim } from "../../src/host/retention.ts";
import { type Run, runsDir } from "../../src/host/run-folder.ts";
import { openDatabase } from "../../src/host/sqlite.ts";
import { trackedRuns } from "../../src/host/tracker.ts";
import type { RunEvent } from "../../src/run/machine.ts";
import { PHASES, type Phase } from "../../src/run/phases.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";
import { CONFIG, doPhase, folder, project, startRun } from "./runs.ts";

vi.setConfig({ testTimeout: 60_000 });

const ID = CONFIG.workspace.id;
type Ending = "done" | "cancelled" | "failed" | "lost";
let clock = Date.parse("2026-11-25T10:00:00Z");

/** A run that ended, its journal and its files as its process leaves them. */
async function ran(data: string, root: string, ending: Ending = "done"): Promise<Run> {
  const run = await startRun(data, root);
  const journal = openJournal(run.dir, () => new Date(clock += 1000));
  const events: RunEvent[] = [];
  const last: Phase = ending === "done" ? "publish" : ending === "lost" || ending === "cancelled" ? "record" : "render";
  for (const phase of PHASES.slice(0, PHASES.indexOf(last) + 1)) {
    events.push({ type: "phase-started", phase });
    if (phase === last && ending !== "done") break;
    await doPhase(run, phase);
    events.push({ type: "phase-finished", phase });
  }
  if (ending === "done") events.push({ type: "done", reel: run.request.reel });
  else if (ending === "cancelled") events.push({ type: "cancel" }, { type: "cancelled" });
  else events.push({ type: "failed", phase: last, message: "broken" });
  for (const event of events) journal.append(event);
  journal.close();
  return run;
}

const setUp = () => {
  const [data, root] = [folder(), project()];
  rememberWorkspace(data, findWorkspace(root));
  const cli = (...args: string[]) => new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
    const child = spawn(process.execPath, [resolve("src/cli.ts"), ...args], { cwd: root, env: { ...process.env, FLOW_REEL_DATA_DIR: data }, stdio: ["ignore", "pipe", "pipe"] });
    const out = { stdout: "", stderr: "" };
    for (const stream of ["stdout", "stderr"] as const) child[stream].setEncoding("utf8").on("data", (text: string) => { out[stream] += text; });
    child.on("close", (code) => done({ code, ...out }));
  });
  return { data, root, cli };
};
const states = (data: string) => trackedRuns(data, ID).map(({ number, state }) => `${number} ${state.state}`);

describe("the tracker", () => {
  it("is the journals' index: removed, damaged or from another version, it is made again and says the same", async () => {
    const { data, root } = setUp();
    for (const ending of ["done", "failed", "cancelled"] as const) await ran(data, root, ending);
    const file = join(data, "tracker.db");
    const before = trackedRuns(data, ID);
    expect(states(data)).toEqual(["3 cancelled", "2 failed", "1 done"]);
    rmSync(file);
    expect(trackedRuns(data, ID)).toEqual(before);
    writeFileSync(file, "not a database, and longer than a header of one hundred bytes ".repeat(4));
    expect(trackedRuns(data, ID)).toEqual(before);
    const bytes = readFileSync(file);
    bytes.fill(0xff, 4096);
    writeFileSync(file, bytes);
    expect(trackedRuns(data, ID)).toEqual(before);
    const db = openDatabase(file);
    db.exec("DROP TABLE runs; CREATE TABLE runs (other); PRAGMA user_version = 99");
    db.close();
    expect(trackedRuns(data, ID)).toEqual(before);
    // It is used: a run whose journal didn't change isn't read again.
    const index = openDatabase(file);
    index.exec("UPDATE runs SET summary = replace(summary, '\"a\"', '\"from the index\"') WHERE number = 1");
    index.close();
    expect(trackedRuns(data, ID).map(({ script }) => script)).toEqual(["a", "a", "from the index"]);
  });

  it("notices that a run went on, and does without its index while another process writes it", async () => {
    const { data, root } = setUp();
    const run = await ran(data, root, "failed");
    expect(states(data)).toEqual(["1 failed"]);
    const journal = openJournal(run.dir);
    for (const event of [{ type: "resumed" }, ...PHASES.slice(0, 3).map((phase) => ({ type: "phase-finished", phase, reused: true } as const)),
      ...PHASES.slice(3).flatMap((phase) => [{ type: "phase-started", phase } as const, { type: "phase-finished", phase } as const]),
      { type: "done", reel: run.request.reel }] as RunEvent[]) journal.append(event);
    journal.close();
    const db = openDatabase(join(data, "tracker.db"));
    db.exec("BEGIN EXCLUSIVE");
    expect(states(data)).toEqual(["1 done"]);
    db.close();
    expect(states(data)).toEqual(["1 done"]);
  });
});

describe("retention", () => {
  it("keeps the heavy files of the last finished runs of a script, and every run's history", async () => {
    const { data, root } = setUp();
    writeFileSync(join(root, "flow-reel.json"), JSON.stringify({ ...CONFIG, keepRuns: 5 }));
    const runs: Run[] = [];
    for (let i = 0; i < 5; i++) runs.push(await ran(data, root));
    const cancelled = await ran(data, root, "cancelled");
    await trim(runs[4]);
    expect(runs.map(({ dir }) => hasHeavyFiles(dir))).toEqual([true, true, true, true, true]);
    runs.push(await ran(data, root));
    await trim(runs[5]);
    expect(runs.map(({ dir }) => hasHeavyFiles(dir))).toEqual([false, true, true, true, true, true]);
    expect(hasHeavyFiles(cancelled.dir)).toBe(true);
    expect(readdirSync(runs[0].dir).sort()).toEqual(["journal.jsonl", "owner.lock", "request.json"]);
    expect(states(data)).toHaveLength(7);
  });

  it("counts as many runs as the workspace says, by when they ended", async () => {
    const { data, root } = setUp();
    writeFileSync(join(root, "flow-reel.json"), JSON.stringify({ ...CONFIG, keepRuns: 1 }));
    const resumed = await startRun(data, root);
    const other = await ran(data, root);
    const journal = openJournal(resumed.dir, () => new Date(clock += 1000));
    for (const phase of PHASES) {
      journal.append({ type: "phase-started", phase });
      await doPhase(resumed, phase);
      journal.append({ type: "phase-finished", phase });
    }
    journal.append({ type: "done", reel: "kept", newer: other.number });
    journal.close();
    await trim(resumed);
    // It ended last, though it started first.
    expect([resumed, other].map(({ dir }) => hasHeavyFiles(dir))).toEqual([true, false]);
  });

  it("never removes the files of a run that is going or can go on", async () => {
    const { data, root } = setUp();
    const [canGoOn, going, lost] = [await ran(data, root, "failed"), await ran(data, root), await ran(data, root, "lost")];
    const lock = takeLock(join(going.dir, "owner.lock"))!;
    expect((await finishedRuns(data, ID)).map(({ number }) => number)).toEqual([lost.number, going.number]);
    expect(await Promise.all([canGoOn, going, lost].map(({ dir }) => removeHeavyFiles(dir)))).toEqual([false, false, true]);
    lock.release();
    expect([canGoOn, going, lost].map(({ dir }) => hasHeavyFiles(dir))).toEqual([true, true, false]);
  });
});

describe("runs and clean", () => {
  it("list this workspace's runs, or every workspace's, and what can be done with them", async () => {
    const { data, root, cli } = setUp();
    expect(await cli("runs")).toEqual({ code: 0, stdout: "", stderr: "flow-reel: this workspace has no runs\n" });
    await ran(data, root);
    await ran(data, root, "failed");
    await removeHeavyFiles((await ran(data, root, "lost")).dir);
    const other = folder();
    writeFileSync(join(other, "flow-reel.json"), JSON.stringify({ ...CONFIG, workspace: { id: "bbbbbbbbbbbb", slug: "other", title: "Other" } }));
    mkdirSync(join(other, "reels"));
    writeFileSync(join(other, "reels/a.reel.ts"), "a");
    rememberWorkspace(data, findWorkspace(other));
    await ran(data, other);
    const lines = (stdout: string) => stdout.trimEnd().split("\n").map((line) => line.split(/ {2,}/).filter((_, column) => column !== 2));
    const shop = [["shop/3", "a", "failed", "can't go on: recording lost; files removed"],
      ["shop/2", "a", "failed", "`flow-reel resume shop/2` goes on from its render phase"], ["shop/1", "a", "done"]];
    expect(lines((await cli("runs")).stdout)).toEqual(shop);
    expect(lines((await cli("runs", "--all")).stdout)).toEqual([["other/1", "a", "done"], ...shop]);
    const rows = (await cli("runs", "--json")).stdout.trim().split("\n").map((line) => JSON.parse(line) as unknown);
    expect(rows).toMatchObject([{ run: "shop/3", state: "failed", why: "broken", lost: "recording lost", files: false },
      { run: "shop/2", resume: "render", files: true }, { run: "shop/1", script: "a", state: "done", reel: join(root, "reels/out/a.reel"), files: true }]);
  });

  it("show what would go and ask; --yes doesn't, and what can go on stays", async () => {
    const { data, root, cli } = setUp();
    expect(await cli("clean", "--yes")).toMatchObject({ code: 0, stdout: "There is nothing to clean.\n" });
    const [done, canGoOn] = [await ran(data, root), await ran(data, root, "failed")];
    const [old, fresh] = [join(runsDir(data, ID), "7"), join(runsDir(data, ID), ".new-x")];
    for (const dir of [old, fresh]) mkdirSync(dir);
    utimesSync(old, new Date("2026-11-01"), new Date("2026-11-01"));
    const asked = await cli("clean");
    expect(asked).toMatchObject({ code: 2, stderr: expect.stringContaining("--yes is needed") as string });
    expect(asked.stdout).toMatch(/shop\/1 +0\.0 MB\n.*a run that never started/);
    expect(hasHeavyFiles(done.dir)).toBe(true);
    const { code, stdout } = await cli("clean", "--yes", "--json");
    expect([code, stdout.trim().split("\n").map((line) => JSON.parse(line) as unknown)])
      .toEqual([0, [{ run: "shop/1", bytes: expect.any(Number) as number, removed: true }, { leftover: old, bytes: 0, removed: true }]]);
    expect([done, canGoOn].map(({ dir }) => hasHeavyFiles(dir))).toEqual([false, true]);
    expect([existsSync(old), existsSync(fresh)]).toEqual([false, true]);
  });
});

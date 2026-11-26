// A run in its own process, on the three systems. Real processes, without containers.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { sendCommand } from "../../src/host/control.ts";
import { rememberWorkspace } from "../../src/host/data.ts";
import { readJournal } from "../../src/host/journal.ts";
import { isLocked, takeLock } from "../../src/host/lock.ts";
import { follow, runState } from "../../src/host/owner.ts";
import { isHeavy } from "../../src/host/queue.ts";
import { type Run, readRun } from "../../src/host/run-folder.ts";
import { findRuns } from "../../src/host/runs.ts";
import { startProcess } from "../../src/host/start.ts";
import { PHASES } from "../../src/run/phases.ts";
import { resolveSettings } from "../../src/settings.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";
import { CONFIG, folder, project, startRun } from "./runs.ts";

// A process starts slowly on a busy Windows machine.
vi.setConfig({ testTimeout: 60_000 });

const PROGRAM = resolve(import.meta.dirname, "slow-run.ts");
const ENGINE = { command: "docker", kind: "docker", desktop: false } as const;
const begin = async (data = folder(), root?: string) => {
  const run = await startRun(data, root);
  await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
  return run;
};
const until = async (what: () => boolean) => {
  for (const deadline = Date.now() + 30_000; !what(); await sleep(20)) if (Date.now() > deadline) throw new Error("waited too long");
};
const recording = (dir: string) => until(() => readJournal(dir).some(({ type }) => type === "phase-started"));
const entries = async (dir: string) => {
  const seen: string[] = [];
  for await (const entry of follow(dir)) seen.push(entry.type);
  return seen;
};
/** Every system's way to end a process at once, without it noticing: SIGKILL, or TerminateProcess on Windows. */
const kill = (dir: string) => process.kill(Number(readFileSync(join(dir, "pid"), "utf8")), "SIGKILL");

describe("a lock", () => {
  it("is held by one, seen by any number, and free once it is released", () => {
    const file = join(folder(), "a.lock");
    expect(isLocked(file)).toBe(false);
    const lock = takeLock(file)!;
    expect(isLocked(file)).toBe(true);
    expect(takeLock(file)).toBeUndefined();
    lock.release();
    expect(isLocked(file)).toBe(false);
    takeLock(file)!.release();
  });

  it("says nothing on the error output, whatever Node thinks of its own SQLite", () => {
    const script = `import { takeLock } from ${JSON.stringify(new URL("../../src/host/lock.ts", import.meta.url).href)};
      takeLock(${JSON.stringify(join(folder(), "a.lock"))}).release();`;
    expect(execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning:TypeStripping", "--input-type=module", "-e", script],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).toBe("");
  });
});

describe("a run's process", () => {
  it("runs on its own to the end, followed from its first entry to its last", async () => {
    const run = await begin();
    const seen = entries(run.dir);
    await recording(run.dir);
    expect(runState(run.dir)).toMatchObject({ state: "running", phase: "record" });
    writeFileSync(join(run.dir, "go"), "");
    expect((await seen).filter((type) => type !== "phase-started" && type !== "phase-finished")).toEqual(["created", "done"]);
    expect(runState(run.dir)).toMatchObject({ state: "done" });
    await until(() => !existsSync(join(run.dir, "control.json")));
    // A run that has ended can be watched too.
    expect((await entries(run.dir)).at(-1)).toBe("done");
  });

  it("takes a cancel, and only from who can read its folder", async () => {
    const run = await begin();
    await recording(run.dir);
    const { address, token } = JSON.parse(readFileSync(join(run.dir, "control.json"), "utf8")) as { address: string; token: string };
    if (process.platform !== "win32") {
      expect(statSync(join(run.dir, "control.json")).mode & 0o777).toBe(0o600);
      expect(statSync(join(address, "..")).mode & 0o777).toBe(0o700);
    }
    const ask = (line: string) => new Promise<string>((done, fail) => {
      const socket = connect(address, () => socket.write(`${line}\n`)).setEncoding("utf8");
      socket.on("data", (answer: string) => { socket.destroy(); done(answer); }).on("error", fail);
    });
    expect(await ask('{"v":1,"token":"another","command":"cancel"}')).toContain("token isn't the run's");
    expect(await ask(JSON.stringify({ v: 1, token, command: "dance" }))).toContain('unknown command \\"dance\\"');
    expect(await ask(JSON.stringify({ v: 2, token, command: "cancel" }))).toContain("this run takes version 1");
    expect(await ask("cancel")).toContain("isn't JSON");
    expect(runState(run.dir)).toMatchObject({ state: "running", cancelling: false });

    await sendCommand(run.dir, "cancel");
    expect((await entries(run.dir)).slice(-2)).toEqual(["cancel", "cancelled"]);
    await until(() => !existsSync(join(run.dir, "control.json")));
    await expect(sendCommand(run.dir, "cancel")).rejects.toThrow("it isn't running");
  });

  it("that is killed is noticed by whoever looks, once", async () => {
    const run = await begin();
    await recording(run.dir);
    const watching = entries(run.dir);
    kill(run.dir);
    expect((await watching).at(-1)).toBe("stopped");
    expect([runState(run.dir), runState(run.dir)]).toMatchObject([{ state: "stopped", ended: { phase: "record", message: "its process ended" } }, { state: "stopped" }]);
    expect(readJournal(run.dir).filter(({ type }) => type === "stopped")).toHaveLength(1);
    await expect(sendCommand(run.dir, "cancel")).rejects.toThrow("it isn't running");
  });

  it("that couldn't start leaves nothing, and says why", async () => {
    const data = folder();
    const run = await startRun(data);
    const broken = join(folder(), "broken.mjs");
    appendFileSync(broken, "throw new Error('broken')");
    await expect(startProcess(run, { engine: ENGINE, image: "none" }, broken)).rejects.toThrow("the run couldn't start");
    expect(readRun(data, "abcdefghijkl", 1)).toBeUndefined();
  });

  it("doesn't die of its starter closing their channel first", async () => {
    const run = await begin();
    await recording(run.dir);
    await sleep(200);
    expect(isLocked(join(run.dir, "owner.lock"))).toBe(true);
    await sendCommand(run.dir, "cancel");
    await entries(run.dir);
  });

  it("is alone: another one can't own the same run", async () => {
    const run = await begin();
    await recording(run.dir);
    await expect(startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM)).rejects.toThrow("another process is running it");
    await sendCommand(run.dir, "cancel");
    await entries(run.dir);
  });
});

describe("finding a run", () => {
  it("by its number, its workspace and number, or its script", async () => {
    const data = folder();
    const root = project();
    rememberWorkspace(data, findWorkspace(root));
    const here = () => findWorkspace(root);
    expect(() => findRuns(data, "a", here)).toThrow('there is no run of "a"');
    const [first, second] = [await begin(data, root), await begin(data, root)];
    await startRun(data, root); // its process hasn't started: it isn't a run yet
    const ids = (name: string) => findRuns(data, name, here).map(({ id }) => id);
    expect(ids("1")).toEqual(["shop/1"]);
    expect(ids("shop/2")).toEqual(["shop/2"]);
    expect(ids("a")).toEqual(["shop/2", "shop/1"]);
    expect(findRuns(data, "shop/1", () => { throw new Error("not in a workspace"); })).toHaveLength(1);
    expect(() => ids("7")).toThrow("there is no run 7");
    expect(() => ids("3")).toThrow("there is no run 3");
    expect(() => ids("shop/x")).toThrow('there is no run of "shop/x"');
    for (const run of [first, second]) { await sendCommand(run.dir, "cancel"); await entries(run.dir); }
  });
});

describe("the commands", () => {
  const CLI = resolve(import.meta.dirname, "../../src/cli.ts");
  async function setUp() {
    const [data, root] = [folder(), project()];
    rememberWorkspace(data, findWorkspace(root));
    const start = (...args: string[]) => {
      const child = spawn(process.execPath, [CLI, ...args], { cwd: root, env: { ...process.env, FLOW_REEL_DATA_DIR: data, NODE_OPTIONS: "--disable-warning=ExperimentalWarning" } });
      const out = { stdout: "", stderr: "", code: undefined as number | null | undefined };
      child.stdout.on("data", (chunk) => { out.stdout += chunk; });
      child.stderr.on("data", (chunk) => { out.stderr += chunk; });
      const done = new Promise<typeof out>((end) => { child.on("close", (code) => { out.code = code; end(out); }); });
      return { child, done, out };
    };
    const cli = (...args: string[]) => start(...args).done;
    const go = async () => { const run = await begin(data, root); await recording(run.dir); return run; };
    return { cli, go, start, data, root };
  }

  it("say how a run ended by their exit codes", async () => {
    const { cli, go } = await setUp();
    const done = await go();
    const [watching, waiting] = [cli("watch", "a"), cli("wait", "1")];
    await sleep(500);
    writeFileSync(join(done.dir, "go"), "");
    expect(await watching).toMatchObject({ code: 0, stdout: "", stderr: expect.stringMatching(/recording\n[^]*publishing\nflow-reel: composed .*a\.reel\n$/) as string });
    expect(await waiting).toEqual({ code: 0, stdout: "", stderr: "" });

    kill((await go()).dir);
    expect(await cli("wait", "a", "--json")).toEqual({ code: 3, stderr: "", stdout: '{"run":"shop/2","state":"stopped","why":"its process ended"}\n' });
    expect((await cli("watch", "a")).stderr).toContain("shop/2 stopped: its process ended\nThe log is ");

    await go();
    expect(await cli("cancel", "a")).toEqual({ code: 0, stdout: "shop/3 is cancelled\n", stderr: "" });
    expect((await cli("wait", "3")).code).toBe(4);
    expect(await cli("cancel", "a")).toMatchObject({ code: 1, stderr: "flow-reel: shop/3 isn't running: it is cancelled\n" });
    expect(await cli("wait", "b")).toMatchObject({ code: 1, stderr: 'flow-reel: there is no run of "b" in this workspace\n' });
    const lines = (await cli("watch", "shop/3", "--json")).stdout.trim().split("\n").map((line) => JSON.parse(line) as { run: string; type: string });
    expect(lines.map(({ run, type }) => `${run} ${type}`)).toEqual(["shop/3 created", "shop/3 phase-started", "shop/3 cancel", "shop/3 cancelled"]);
  });

  it("let a run that was killed go on with what it has, and never record again", async () => {
    const { cli, go, data, root } = await setUp();
    kill((await go()).dir);
    expect(await cli("resume", "a")).toMatchObject({ code: 1,
      stderr: "flow-reel: shop/1 can't go on (recording lost): `flow-reel compose reels/a.reel.ts` starts a new run\n" });
    expect((await cli("watch", "a")).stderr).toContain("It can't go on (recording lost)");
    await expect(startProcess(readRun(data, "abcdefghijkl", 1)!, { engine: ENGINE, image: "none" }, PROGRAM)).rejects.toThrow("recording lost");

    expect(await cli("resume", "1")).toMatchObject({ code: 1, stderr: expect.stringContaining("recording lost") as string });
  });

  it.each(["voice", "plan", "render", "publish"] as const)("let a run killed in its %s phase go on from there", async (phase) => {
    const { cli, data, root } = await setUp();
    const run = await startRun(data, root);
    writeFileSync(join(run.dir, "at"), phase);
    await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
    await until(() => readJournal(run.dir).some((entry) => entry.type === "phase-started" && entry.phase === phase));
    kill(run.dir);
    expect((await cli("watch", "a")).stderr).toContain(`\`flow-reel resume 1\` goes on from its ${phase} phase`);
    writeFileSync(join(run.dir, "go"), "");
    await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
    expect((await entries(run.dir)).at(-1)).toBe("done");
    const journal = readJournal(run.dir).map((entry) => "phase" in entry && entry.phase ? `${entry.type} ${entry.phase}${"reused" in entry ? " again" : ""}` : entry.type);
    const at = PHASES.indexOf(phase);
    expect(journal.slice(journal.indexOf("stopped"))).toEqual(["stopped", "resumed", ...PHASES.slice(0, at).map((done) => `phase-finished ${done} again`),
      ...PHASES.slice(at).flatMap((next) => [`phase-started ${next}`, `phase-finished ${next}`]), "done"]);
    expect(await cli("resume", "1")).toMatchObject({ code: 1, stderr: "flow-reel: shop/1 is done: it has nothing to go on with\n" });
  });

  it("refuse to change a run when the name means several", async () => {
    const { cli, go, data, root } = await setUp();
    await go();
    await begin(data, root);
    expect(await cli("cancel", "a")).toMatchObject({ code: 1, stderr: 'flow-reel: "a" means 2 runs: name one of shop/2, shop/1\n' });
    expect((await cli("cancel", "1")).code).toBe(0);
    expect((await cli("cancel", "a")).stdout).toBe("shop/2 is cancelled\n");
  });

  // Windows has no interrupt to send another process.
  it.skipIf(process.platform === "win32")("stop watching on an interrupt, and the run goes on", async () => {
    const { start, go, cli } = await setUp();
    const run = await go();
    const watching = start("watch", "a");
    await until(() => watching.out.stderr.includes("recording"));
    watching.child.kill("SIGINT");
    expect(await watching.done).toMatchObject({ code: 0, stderr: expect.stringContaining("shop/1 is still running") as string });
    expect(runState(run.dir)).toMatchObject({ state: "running" });
    await cli("cancel", "1");
  });
});

it("a run's process trims the older runs of its script when it ends (GH-120)", async () => {
  const [data, root] = [folder(), project()];
  writeFileSync(join(root, "flow-reel.json"), JSON.stringify({ ...CONFIG, keepRuns: 1 }));
  const runs: Run[] = [];
  for (const _ of [1, 2]) {
    const run = await startRun(data, root);
    writeFileSync(join(run.dir, "go"), "");
    await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
    await entries(run.dir);
    runs.push(run);
  }
  await until(() => !existsSync(join(runs[0].dir, "scripts")));
  expect(existsSync(join(runs[1].dir, "scripts"))).toBe(true);
});

describe("heavy work", () => {
  /** When each heavy phase went on, in a data folder's runs, in the order they started. */
  const heavy = (runs: Run[]) => runs.flatMap(({ number, dir }) => {
    const journal = readJournal(dir);
    return journal.flatMap((entry) => {
      if (entry.type !== "phase-started" || !["record", "voice", "render"].includes(entry.phase)) return [];
      const end = journal.find((other) => other.type === "phase-finished" && other.phase === entry.phase);
      return [{ what: `${entry.phase} ${number}`, from: Date.parse(entry.at), to: Date.parse(end!.at) }];
    });
  }).sort((a, b) => a.from - b.from);
  const waitsFor = (dir: string) => readJournal(dir).flatMap((entry) => entry.type === "waiting" ? [`${entry.phase} behind ${entry.behind}`] : []);

  it("takes turns, in the order it was asked for", async () => {
    const [data, root] = [folder(), project()];
    rememberWorkspace(data, findWorkspace(root));
    const runs: Run[] = [];
    for (const _ of [1, 2, 3]) {
      const run = await startRun(data, root);
      runs.push(run);
      await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
      await until(() => readJournal(run.dir).length > 1); // it has asked
    }
    await until(() => waitsFor(runs[2].dir).length > 0);
    expect(runs.map(({ dir }) => runState(dir))).toMatchObject([{ state: "running", phase: "record" },
      { state: "queued", waiting: { phase: "record", behind: "shop/1" } }, { state: "queued", waiting: { phase: "record", behind: "shop/1" } }]);
    for (const { dir } of runs) writeFileSync(join(dir, "go"), "");
    for (const { dir } of runs) expect((await entries(dir)).at(-1)).toBe("done");
    const work = heavy(runs);
    expect(work.map(({ what }) => what)).toEqual(["record", "voice", "render"].flatMap((phase) => [1, 2, 3].map((run) => `${phase} ${run}`)));
    for (const [i, { what, from }] of work.entries()) expect([what, i === 0 || from >= work[i - 1].to]).toEqual([what, true]);
  });

  it("skips a run that died while it worked or waited, and one that was cancelled while it waited", async () => {
    const [data, root] = [folder(), project()];
    const runs: Run[] = [];
    for (const _ of [1, 2, 3, 4]) {
      const run = await startRun(data, root);
      runs.push(run);
      await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
      await until(() => readJournal(run.dir).length > 1);
    }
    const [worked, waited, cancelled, last] = runs;
    kill(waited.dir);
    await sendCommand(cancelled.dir, "cancel");
    expect((await entries(cancelled.dir)).at(-1)).toBe("cancelled");
    expect(runState(last.dir)).toMatchObject({ state: "queued" });
    kill(worked.dir);
    await recording(last.dir);
    writeFileSync(join(last.dir, "go"), "");
    expect((await entries(last.dir)).at(-1)).toBe("done");
  });

  it("is a recording, a render and a local voice, not a cloud voice", () => {
    const local = resolveSettings(undefined);
    const cloud = resolveSettings({ voice: { adapter: "openai" } });
    expect(PHASES.filter((phase) => isHeavy(phase, local))).toEqual(["record", "voice", "render"]);
    expect(PHASES.filter((phase) => isHeavy(phase, cloud))).toEqual(["record", "render"]);
  });
});

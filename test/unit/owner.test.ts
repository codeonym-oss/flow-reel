// A run in its own process, on the three systems. Real processes, without containers.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { sendCommand } from "../../src/host/control.ts";
import { rememberWorkspace } from "../../src/host/data.ts";
import { readJournal } from "../../src/host/journal.ts";
import { isLocked, takeLock } from "../../src/host/lock.ts";
import { follow, runState } from "../../src/host/owner.ts";
import { readRun } from "../../src/host/run-folder.ts";
import { findRuns } from "../../src/host/runs.ts";
import { startProcess } from "../../src/host/start.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";
import { folder, project, startRun } from "./runs.ts";

const PROGRAM = resolve(import.meta.dirname, "slow-run.ts");
const ENGINE = { command: "docker", kind: "docker", desktop: false } as const;
const begin = async (data = folder(), root?: string) => {
  const run = await startRun(data, root);
  await startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM);
  return run;
};
const until = async (what: () => boolean) => {
  for (const deadline = Date.now() + 8000; !what(); await sleep(20)) if (Date.now() > deadline) throw new Error("waited too long");
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

  it("is alone: another one can't own the same run", async () => {
    const run = await begin();
    await recording(run.dir);
    await expect(startProcess(run, { engine: ENGINE, image: "none" }, PROGRAM)).rejects.toThrow("another process is running it");
    await sendCommand(run.dir, "cancel");
    await entries(run.dir);
  }, 15_000);
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
    return { cli, go, start };
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
  }, 30_000);

  it("refuse to change a run when the name means several", async () => {
    const { cli, go } = await setUp();
    await go();
    await go();
    expect(await cli("cancel", "a")).toMatchObject({ code: 1, stderr: 'flow-reel: "a" means 2 runs: name one of shop/2, shop/1\n' });
    expect((await cli("cancel", "1")).code).toBe(0);
    expect((await cli("cancel", "a")).stdout).toBe("shop/2 is cancelled\n");
  }, 30_000);

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
  }, 30_000);
});

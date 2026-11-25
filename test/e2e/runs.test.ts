// Runs in their own processes, with the real containers: watched, cancelled, killed and resumed (GH-117, GH-118).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planReel } from "../../src/composer/phases/plan.ts";
import { readJournal } from "../../src/host/journal.ts";
import { runState } from "../../src/host/owner.ts";
import { readCues, readPlan, readVoiced } from "../../src/host/reel.ts";
import type { Phase } from "../../src/run/phases.ts";
import type { Config } from "../../src/workspace/config.ts";
import { tone } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";
import { type Project, cliEnv, lastRun, makeProject } from "./project.ts";

const OUT = resolve("test/e2e/out/runs");
const html = readFileSync(resolve("test/e2e/app/index.html"));
let server: Server;
let port: number;
/** What the app and the voice were asked. */
let [visits, spoken] = [0, 0];
/** Whether the voice answers. */
let silent = false;

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  prepareImage("cloud");
  server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/audio/speech") {
      req.resume().on("end", () => {
        spoken++;
        if (!silent) res.writeHead(200, { "content-type": "audio/pcm" }).end(tone());
      });
      return;
    }
    if (req.url === "/") visits++;
    res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
}, 900_000);

afterAll(() => { server?.closeAllConnections(); server?.close(); });

const SLOW = `import { script } from "flow-reel";
export default script({ url: "http://localhost:PORT/", viewport: [960, 540] }, async () => {
  console.log("the script is running");
  await new Promise((resolve) => setTimeout(resolve, 60_000));
});
`;
const SPOKEN = `import { script } from "flow-reel";
export default script({ url: "http://localhost:PORT/", viewport: [960, 540] }, async ({ page, comment }) => {
  comment("Type a name.");
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("button", { name: "Save" }).comment("Save it.").click();
});
`;
const containers = (phase: string) => spawnSync("docker", ["ps", "--quiet", "--filter", `name=flow-reel-${phase}-`], { encoding: "utf8" }).stdout.trim();
const until = async (what: () => boolean) => {
  for (const deadline = Date.now() + 60_000; !what(); await sleep(100)) if (Date.now() > deadline) throw new Error("waited a minute");
};
const logOf = (project: Project) => { try { return readFileSync(join(lastRun(project), "log.txt"), "utf8"); } catch { return ""; } };
const workspace = (name: string, script: string, config: Partial<Config> = {}) => makeProject(join(OUT, name),
  { "demo.reel.ts": script.replace("PORT", String(port)) }, { voice: { adapter: "openai", baseUrl: `http://localhost:${port}/v1` }, ...config });
const composing = (project: Project) => {
  const child = spawn(process.execPath, ["dist/cli.js", "compose", join(project.scripts, "demo.reel.ts")], { env: cliEnv(), stdio: "ignore" });
  return { child, exited: new Promise<number | null>((done) => { child.on("exit", done); }) };
};
/** Async: the app is served by this process. */
const cli = async (project: Project, ...args: string[]) => {
  const child = spawn(process.execPath, [resolve("dist/cli.js"), ...args], { cwd: project.root, env: cliEnv() });
  const out = { stdout: "", stderr: "" };
  for (const stream of ["stdout", "stderr"] as const) child[stream].setEncoding("utf8").on("data", (text: string) => { out[stream] += text; });
  const status = await new Promise<number | null>((done) => { child.on("close", done); });
  return { status, ...out };
};
/** Kills a run's process, as a crash or a full memory does. */
const kill = (run: string) => process.kill(Number(spawnSync("pgrep", ["-f", `run-process.js ${run}`], { encoding: "utf8" }).stdout.trim()), "SIGKILL");
const inPhase = (run: string, phase: Phase) => readJournal(run).some((entry) => entry.type === "phase-started" && entry.phase === phase);

describe("a run's own process (GH-117)", () => {
  const start = async (name: string) => {
    const project = workspace(name, SLOW);
    const { child, exited } = composing(project);
    // A script's own output goes to the run's log.
    await until(() => logOf(project).includes("the script is running"));
    expect(containers("record")).not.toBe("");
    return { project, child, exited, run: lastRun(project) };
  };

  it("outlives the command and its terminal, and ends when it is cancelled", async () => {
    const { project, child, exited, run } = await start("closed");
    child.kill("SIGHUP");
    await exited;
    await sleep(3000);
    expect(containers("record")).not.toBe("");
    expect(runState(run)).toMatchObject({ state: "running", phase: "record" });
    expect(await cli(project, "cancel", "demo")).toMatchObject({ status: 0, stderr: "" });
    expect(runState(run)).toMatchObject({ state: "cancelled" });
    expect(containers("record")).toBe("");
    expect(readdirSync(project.scripts)).toEqual(["demo.reel.ts"]);
  }, 180_000);

  it("is cancelled by Ctrl+C in the compose that shows it", async () => {
    const { child, exited, run } = await start("interrupted");
    child.kill("SIGINT");
    expect(await exited).toBe(4);
    expect(runState(run)).toMatchObject({ state: "cancelled" });
    expect(containers("record")).toBe("");
  }, 180_000);

  it("takes its container with it when it is killed, and the next command says it stopped", async () => {
    const { project, exited, run } = await start("killed");
    kill(run);
    expect(await exited).toBe(3);
    await until(() => containers("record") === "");
    expect((await cli(project, "wait", "demo", "--json")).stdout).toContain('"state":"stopped","why":"its process ended"');
    expect(readdirSync(project.scripts)).toEqual(["demo.reel.ts"]);
  }, 180_000);
});

describe("a run that stopped (GH-118)", () => {
  it("goes on to its reel without repeating what it finished", async () => {
    const project = workspace("resumed", SPOKEN);
    [visits, spoken] = [0, 0];
    silent = true;
    const first = composing(project);
    await until(() => spoken === 2);
    const run = lastRun(project);
    kill(run);
    expect(await first.exited).toBe(3);
    await until(() => containers("voice") === "");
    expect((await cli(project, "watch", "demo")).stderr).toContain("goes on from its voice phase");

    silent = false;
    expect(await cli(project, "resume", "demo", "--detach")).toMatchObject({ status: 0 });
    await until(() => inPhase(run, "render"));
    kill(run);
    await until(() => containers("render") === "");
    const resumed = await cli(project, "resume", "demo");
    expect(resumed).toMatchObject({ status: 0 });
    expect(resumed.stderr).toMatch(/recording: already done\n.*voicing: already done\n.*planning: already done\n.*rendering\n[^]*composed/);

    // The script ran once, and nothing finished was spoken again: the two that were cut off, then both.
    expect(visits).toBe(1);
    expect(spoken).toBe(4);
    const { brand, sound } = JSON.parse(readFileSync(join(run, "request.json"), "utf8")) as Parameters<typeof planReel>[2];
    expect(readPlan(run)).toEqual(planReel(readCues(run), readVoiced(run), { brand, sound }));
    expect(await cli(project, "verify", join(project.output, "demo.reel"))).toMatchObject({ status: 0 });
    expect(readdirSync(project.scripts).sort()).toEqual(["demo.reel.ts", "out"]);
  }, 300_000);

  it("isn't recorded again", async () => {
    const project = workspace("lost", SLOW);
    const { exited } = composing(project);
    await until(() => logOf(project).includes("the script is running"));
    kill(lastRun(project));
    expect(await exited).toBe(3);
    expect(await cli(project, "resume", "demo")).toMatchObject({ status: 1, stderr: expect.stringContaining("(recording lost): `flow-reel compose reels/demo.reel.ts`") as string });
  }, 180_000);

  it("took longer than its limit: it fails, and its container is gone", async () => {
    const project = workspace("limit", SLOW, { limits: { record: 0.1 } });
    const { status, stderr } = await cli(project, "compose", join(project.scripts, "demo.reel.ts"));
    expect(status).toBe(1);
    expect(stderr).toContain("failed: recording took longer than its limit of 0.1 minutes (limits.record in flow-reel.json)");
    expect(containers("record")).toBe("");
  }, 180_000);
});

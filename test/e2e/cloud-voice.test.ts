// A cloud voice through the whole composer (GH-49): the host passes the key's variable by name, the container calls the
// provider (here a server on the host that answers like OpenAI), and a second compose reuses every clip.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runState } from "../../src/host/owner.ts";
import { FAKE_KEY, tone } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";
import { type Project, cliEnv, compose, lastRun, makeProject } from "./project.ts";

const OUT = resolve("test/e2e/out/cloud-voice");
const html = readFileSync(resolve("test/e2e/app/index.html"));
const KEY = FAKE_KEY;
let server: Server;
let port: number;
const requests: { auth?: string; body: { model: string; input: string; voice: string; response_format: string } }[] = [];

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  prepareImage("cloud");
  server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/audio/speech") {
      let text = "";
      req.on("data", (chunk) => { text += chunk; });
      req.on("end", () => {
        requests.push({ auth: req.headers.authorization, body: JSON.parse(text) });
        res.writeHead(200, { "content-type": "audio/pcm" }).end(tone());
      });
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
}, 900_000);

afterAll(() => server?.close());

it("composes with a cloud voice, and reuses its clips on the next compose", async () => {
  const dir = join(OUT, "openai");
  const project = makeProject(dir, { "demo.reel.ts": `import { script } from "flow-reel";

export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ page, comment }) => {
  comment("Type a name.");
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("button", { name: "Save" }).comment("Save it.").click();
});
` }, { voice: { adapter: "openai", speaker: "nova", baseUrl: `http://localhost:${port}/v1` } });

  const first = await compose(project);
  expect(first.stderr).toContain("voiced 2 of 2 comments (0 reused)");
  // It says each step as it plays, and its journal holds the run (GH-116).
  expect(first.stderr).toMatch(/recording\n.*step 1: Type a name\.\n.*step 2: Save it\.\n.*voicing\n[^]*rendering\n[^]*composed/);
  expect(runState(lastRun(project))).toMatchObject({ state: "done", reel: { path: first.reel, published: true } });
  // Comments are voiced concurrently, so their requests arrive in either order.
  expect([...requests].sort((a, b) => a.body.input.localeCompare(b.body.input))).toEqual([
    { auth: `Bearer ${KEY}`, body: { model: "gpt-4o-mini-tts", input: "Save it.", voice: "nova", response_format: "pcm" } },
    { auth: `Bearer ${KEY}`, body: { model: "gpt-4o-mini-tts", input: "Type a name.", voice: "nova", response_format: "pcm" } },
  ]);
  const transcript = JSON.parse(readFileSync(join(first.reel, "transcript.json"), "utf8"));
  expect(transcript.voice).toEqual({ adapter: "openai:gpt-4o-mini-tts", voice: "nova", seed: 0, language: "auto" });
  for (const step of transcript.steps) expect(step.audio.durationMs).toBe(1200);
  for (const file of ["transcript.json", "manifest.json", "events.json"]) {
    expect(readFileSync(join(first.reel, file), "utf8")).not.toContain(KEY);
  }

  // The key reaches the voice's container only, and no file of the run.
  const run = lastRun(project);
  for (const file of readdirSync(run, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())) {
    expect(readFileSync(join(file.parentPath, file.name)).includes(KEY)).toBe(false);
  }

  const second = await compose(project);
  expect(second.stderr).toContain("voiced 0 of 2 comments (2 reused)");
  expect(requests).toHaveLength(2);
}, 900_000);

describe("a run's own process (GH-117)", () => {
  const SLOW = `import { script } from "flow-reel";
export default script({ url: "http://localhost:PORT/", viewport: [960, 540] }, async () => {
  console.log("the script is running");
  await new Promise((resolve) => setTimeout(resolve, 60_000));
});
`;
  const containers = () => spawnSync("docker", ["ps", "--quiet", "--filter", "name=flow-reel-record-"], { encoding: "utf8" }).stdout.trim();
  const until = async (what: () => boolean) => {
    for (const deadline = Date.now() + 60_000; !what(); await sleep(200)) if (Date.now() > deadline) throw new Error("waited a minute");
  };
  const logOf = (project: Project) => { try { return readFileSync(join(lastRun(project), "log.txt"), "utf8"); } catch { return ""; } };
  const start = async (name: string) => {
    const project = makeProject(join(OUT, name), { "demo.reel.ts": SLOW.replace("PORT", String(port)) },
      { voice: { adapter: "openai", baseUrl: `http://localhost:${port}/v1` } });
    const child = spawn(process.execPath, ["dist/cli.js", "compose", join(project.scripts, "demo.reel.ts")], { env: cliEnv(), stdio: "ignore" });
    const exited = new Promise<number | null>((done) => { child.on("exit", done); });
    // A script's own output goes to the run's log.
    await until(() => logOf(project).includes("the script is running"));
    expect(containers()).not.toBe("");
    return { project, child, exited, run: lastRun(project) };
  };
  const cli = (project: Project, ...args: string[]) =>
    spawnSync(process.execPath, [resolve("dist/cli.js"), ...args], { cwd: project.root, env: cliEnv(), encoding: "utf8" });

  it("outlives the command and its terminal, and ends when it is cancelled", async () => {
    const { project, child, exited, run } = await start("closed");
    child.kill("SIGHUP");
    await exited;
    await sleep(3000);
    expect(containers()).not.toBe("");
    expect(runState(run)).toMatchObject({ state: "running", phase: "record" });
    expect(cli(project, "cancel", "demo")).toMatchObject({ status: 0, stderr: "" });
    expect(runState(run)).toMatchObject({ state: "cancelled" });
    expect(containers()).toBe("");
    expect(readdirSync(project.scripts)).toEqual(["demo.reel.ts"]);
  }, 180_000);

  it("is cancelled by Ctrl+C in the compose that shows it", async () => {
    const { child, exited, run } = await start("interrupted");
    child.kill("SIGINT");
    expect(await exited).toBe(4);
    expect(runState(run)).toMatchObject({ state: "cancelled" });
    expect(containers()).toBe("");
  }, 180_000);

  it("takes its container with it when it is killed, and the next command says it stopped", async () => {
    const { project, exited, run } = await start("killed");
    const pid = spawnSync("pgrep", ["-f", `run-process.js ${run}`], { encoding: "utf8" }).stdout.trim();
    process.kill(Number(pid), "SIGKILL");
    expect(await exited).toBe(3);
    await until(() => containers() === "");
    expect(cli(project, "wait", "demo", "--json").stdout).toContain('"state":"stopped","why":"its process ended"');
    expect(readdirSync(project.scripts)).toEqual(["demo.reel.ts"]);
  }, 180_000);
});

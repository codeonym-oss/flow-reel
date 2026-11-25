// The plugin's worked example composes with the candidate image, and its helpers work on the real reel (GH-6
// impl.md step 13): what an agent following the plugin would do, minus the agent.
import { execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prepareImage } from "./image.ts";
import { compose, makeProject } from "./project.ts";

const OUT = resolve("test/e2e/out/plugin");
const example = resolve("plugin/examples/saved-views");
// The plugin still teaches 0.7; its example is composed as a workspace (GH-121 updates the plugin).
const script = join(OUT, "reels/script.reel.ts");
let server: Server;

beforeAll(async () => {
  prepareImage("full");
  makeProject(OUT, {});
  cpSync(example, OUT, { recursive: true, filter: (file) => !file.endsWith("flow-reel.json") });
  mkdirSync(join(OUT, "reels"));
  renameSync(join(OUT, "script.ts"), script);
  const html = readFileSync(join(example, "index.html"));
  server = createServer((_, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(html); });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  writeFileSync(script, readFileSync(script, "utf8").replace("http://localhost:4173/", `http://localhost:${port}/`));
});
afterAll(() => server?.close());

const run = (args: string[]) => promisify(execFile)(process.execPath, args, { encoding: "utf8", maxBuffer: 16 << 20 });

it("composes the saved-views example, and preflight and stills pass on it", async () => {
  const port = (server.address() as AddressInfo).port;
  const preflight = await run(["plugin/scripts/preflight.mjs", "--version", JSON.parse(readFileSync("package.json", "utf8")).version,
    "--url", `http://localhost:${port}/`, "--script", script]);
  expect(preflight.stdout).not.toMatch(/^fail/m);

  const { reel } = await compose({ root: OUT, scripts: join(OUT, "reels"), output: join(OUT, "reels/out") }, "script");
  const transcript = JSON.parse(readFileSync(join(reel, "transcript.json"), "utf8"));
  expect(transcript.steps.map((s: { comment: string }) => s.comment)).toEqual([
    "Here are this quarter's projects. Let's look at the active ones.",
    "The chart follows the filter: active work is picking up every week.",
    "To come back to this view later, save it.",
    "It's in the sidebar now, one click away.",
  ]);
  const events = JSON.parse(readFileSync(join(reel, "events.json"), "utf8")).events as { type: string; name?: string; zoom?: string; t: number }[];
  expect(events.filter((e) => e.type === "sound").map((e) => e.name)).toEqual(["toggle", "open", "success"]);
  expect(events.filter((e) => e.type === "zoom").map((e) => e.zoom)).toEqual(["in", "out"]);

  const stills = await run(["plugin/scripts/stills.mjs", reel, "--to", join(OUT, "stills"), "--flow-reel", "dist/cli.js", "--json"]);
  const report = JSON.parse(stills.stdout);
  expect(report.frames).toHaveLength(transcript.steps.length * 2);
  expect(report.media).toMatchObject({ width: 1920, height: 1080, audio: true });
});

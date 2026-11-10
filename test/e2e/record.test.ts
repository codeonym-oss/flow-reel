import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type EventLog, validateEvents } from "../../src/schema/events.ts";
import { type Transcript, validateTranscript } from "../../src/schema/transcript.ts";

// The whole recorder, in Docker, against a fixture app served from the host's 127.0.0.1 (GH-2 impl.md step 12).
const OUT = resolve("test/e2e/out");
const html = readFileSync(resolve("test/e2e/app/index.html"));
let server: Server;
let port: number;

const script = (p: number) => `import { demo } from "flow-reel";

export default demo({ url: "http://localhost:${p}/" }, async ({ page, step }) => {
  await step("Type a name.", () => page.getByRole("textbox", { name: "Name" }).fill("Ada"));
  await step("Scroll down and save.", () => page.getByRole("button", { name: "Save" }).click());
  await step("Open the settings.", () => page.getByRole("link", { name: "Settings" }).click());
});
`;

interface Run { dir: string; transcript: Transcript; events: EventLog }

// Async: the fixture server lives in this process, so the event loop must stay free while the recording runs.
async function recordOnce(name: string): Promise<Run> {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "demo.ts"), script(port));
  const { stderr } = await promisify(execFile)(process.execPath, ["dist/cli.js", "record", join(dir, "demo.ts")]);
  if (stderr) console.error(stderr);
  return {
    dir,
    transcript: JSON.parse(readFileSync(join(dir, "demo.transcript.json"), "utf8")),
    events: JSON.parse(readFileSync(join(dir, "demo.events.json"), "utf8")),
  };
}

function probe(file: string) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets",
    "-show_entries", "stream=width,height,r_frame_rate,nb_read_packets:format=duration", "-of", "json", file], { encoding: "utf8" });
  const { streams: [s], format } = JSON.parse(out);
  return { width: s.width, height: s.height, fps: s.r_frame_rate, frames: Number(s.nb_read_packets), seconds: Number(format.duration) };
}

/** The time of the first frame whose top-left corner is magenta: when the marker click painted. */
function firstMagentaMs(file: string): number {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "crop=64:64:0:0,scale=1:1,format=rgb24",
    "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  for (let i = 0; i + 2 < raw.length; i += 3) {
    if (raw[i] > 200 && raw[i + 1] < 60 && raw[i + 2] > 200) return ((i / 3) * 1000) / 30;
  }
  throw new Error("no magenta frame");
}

let a: Run;
let b: Run;

beforeAll(async () => {
  rmSync(OUT, { recursive: true, force: true });
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  execFileSync("docker", ["build", "-q", "-t", `ghcr.io/codeonym-oss/flow-reel:${version}`, "-f", "docker/Dockerfile", "."], { stdio: "inherit" });
  server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(html));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  a = await recordOnce("a");
  b = await recordOnce("b");
}, 900_000);

afterAll(() => server?.close());

describe("flow-reel record", () => {
  it("writes a 1440p 30 fps master and a 1080p copy, dropping no frames", () => {
    const master = probe(join(a.dir, ".flow-reel/demo/master.mp4"));
    expect(master).toMatchObject({ width: 2560, height: 1440, fps: "30/1" });
    expect(Math.abs(master.frames - master.seconds * 30)).toBeLessThanOrEqual(master.seconds * 30 * 0.01 + 1);
    expect(probe(join(a.dir, "demo.mp4"))).toMatchObject({ width: 1920, height: 1080, fps: "30/1" });
    expect(readFileSync(join(a.dir, ".flow-reel/.gitignore"), "utf8")).toBe("*\n");
  });

  it("writes a valid transcript and event log", () => {
    expect(validateTranscript(a.transcript)).toEqual([]);
    expect(validateEvents(a.events)).toEqual([]);
    expect(a.transcript.steps).toHaveLength(3);
    expect(a.events.events.map((e) => e.type)).toEqual(["move", "click", "type", "scroll", "move", "click", "scroll", "move", "click"]);
  });

  it("gives the same steps on two runs, every start within ±150 ms (story decision 009)", () => {
    expect(b.transcript.steps).toHaveLength(a.transcript.steps.length);
    a.transcript.steps.forEach((s, i) => {
      expect(Math.abs(s.startMs - b.transcript.steps[i].startMs)).toBeLessThanOrEqual(150);
    });
  });

  it("times events on the video's own clock: the marker click shows within 2 frames of its t", () => {
    const click = a.events.events.filter((e) => e.type === "click").at(-1)!;
    expect(Math.abs(firstMagentaMs(join(a.dir, "demo.mp4")) - click.t)).toBeLessThanOrEqual(2 * 1000 / 30);
  });
});

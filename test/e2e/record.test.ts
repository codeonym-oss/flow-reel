import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CueSheet } from "../../src/composer/schema/cues.ts";
import { SOUND_NAMES, type EventLog, validateEvents } from "../../src/composer/schema/events.ts";
import { compareTranscripts } from "../../src/compare.ts";
import { validateSync } from "../../src/composer/schema/sync.ts";
import { type Transcript, validateTranscript } from "../../src/composer/schema/transcript.ts";
import { planPolish } from "../../src/composer/polish.ts";
import { resolveSettings } from "../../src/settings.ts";
import { verifyReel } from "../../src/reel.ts";
import type { ContainerRequest } from "../../src/container/protocol.ts";
import { startFixtureApp } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";
import { type Project, compose, lastRun, makeProject } from "./project.ts";

// The whole recorder, in Docker, against a fixture app served from the host's 127.0.0.1 (GH-2 impl.md step 12), with
// the local voice. Effects, overlays, waits and cards are in record-*.test.ts, so CI can run them in parallel (GH-92).
const OUT = resolve("test/e2e/out/record");
let app: Awaited<ReturnType<typeof startFixtureApp>>;
let port: number;
let image: string;
const COMMENTS = ["  Type <b>Ada</b> & &lt; --> 保存.\r\n  ", "Scroll down and save.", "Open the settings."];

const script = (p: number, viewport?: [number, number]) => `import { script, Sounds } from "flow-reel";

export default script(${JSON.stringify({ url: `http://localhost:${p}/`, viewport })}, async ({ page, comment }) => {
  comment(${JSON.stringify(COMMENTS[0])});
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("button", { name: "Save" }).comment(${JSON.stringify(COMMENTS[1])}).sound(Sounds.feedback.SUCCESS).click();
  await page.getByRole("link", { name: "Settings" }).comment(${JSON.stringify(COMMENTS[2])}).sound(Sounds.navigation.OPEN).click();
});
`;

interface Run { project: Project; reel: string; transcript: Transcript; events: EventLog }

async function recordOnce(name: string): Promise<Run> {
  const project = makeProject(join(OUT, name), { "demo.reel.ts": script(port) });
  const { reel } = await compose(project);
  return { project, reel,
    transcript: JSON.parse(readFileSync(join(reel, "transcript.json"), "utf8")),
    events: JSON.parse(readFileSync(join(reel, "events.json"), "utf8")),
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
  mkdirSync(OUT, { recursive: true });
  image = prepareImage("full");
  app = await startFixtureApp();
  port = app.port;
}, 900_000);

afterAll(() => app?.close());

it("records all eight sounds without comments and keeps them in the event log when muted", async () => {
  const { reel } = await compose(makeProject(join(OUT, "muted-cues"), { "demo.reel.ts": `import { script, Sounds } from "flow-reel";
export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ sound }) => {
  for (const group of Object.values(Sounds)) {
    for (const name of Object.values(group)) {
      sound(name);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
});` }), "demo", ["--no-sound"]);
  const log = JSON.parse(readFileSync(join(reel, "events.json"), "utf8"));
  expect(validateEvents(log)).toEqual([]);
  expect(log.events.map((e: { name: string }) => e.name)).toEqual(SOUND_NAMES);
  expect(log.events.every((e: { t: number }, i: number) => i === 0 || e.t > log.events[i - 1].t)).toBe(true);
  const { streams } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", join(reel, "video.mp4")], { encoding: "utf8" }));
  expect(streams.map((s: { codec_type: string }) => s.codec_type)).toEqual(["video"]);
}, 120_000);

it("captures the settled response while keeping the callback finish time", async () => {
  const { reel } = await compose(makeProject(join(OUT, "settled"), { "demo.reel.ts": `import { script } from "flow-reel";
export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ page }) => {
  await page.evaluate(() => {
    void fetch("/delayed").then(() => document.body.classList.add("flash"));
  });
});` }));
  const transcript: Transcript = JSON.parse(readFileSync(join(reel, "transcript.json"), "utf8"));
  const step = transcript.steps[0];
  expect(step.endMs - step.actionEndMs).toBeGreaterThanOrEqual(900);
  const painted = firstMagentaMs(join(reel, "video.mp4"));
  expect(painted).toBeGreaterThan(step.actionEndMs);
  expect(painted).toBeLessThan(step.endMs);
}, 120_000);

it("fails the voice phase without a result when TTS assets are missing", async () => {
  const dir = join(OUT, "missing-assets");
  rmSync(dir, { recursive: true, force: true });
  for (const part of ["empty-model", "record", "previous", "out"]) mkdirSync(join(dir, part), { recursive: true });
  const cues: CueSheet = { version: 1, script: { file: "demo.reel.ts", sha256: "a".repeat(64) }, integration: "playwright", platform: "linux/amd64",
    viewport: [960, 540], fps: 30, autoZoom: true, capture: { file: "capture.mp4", frames: 60, cutMs: 1000 }, events: [],
    steps: [{ index: 0, comment: "Hello.", startMs: 0, actionEndMs: 100, endMs: 200 }] };
  writeFileSync(join(dir, "record/cues.json"), JSON.stringify(cues));
  const request: ContainerRequest = { phase: "voice", voice: resolveSettings(undefined).voice };
  const container = `flow-reel-missing-tts-${randomUUID()}`;
  try {
    await expect(promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--interactive", "--network", "none",
      "--user", `${process.getuid!()}:${process.getgid!()}`, ...["record", "previous"].flatMap((part) => ["-v", `${join(dir, part)}:/${part}:ro`]),
      "-v", `${join(dir, "out")}:/out`, "-v", `${join(dir, "empty-model")}:/opt/flow-reel/tts-model:ro`, image, JSON.stringify(request)], { timeout: 90_000 }))
      .rejects.toMatchObject({ code: 1, stdout: expect.stringMatching(/^\{"type":"failed","message":"Qwen TTS failed/), stderr: expect.stringContaining("Qwen TTS failed") });
  } finally {
    // A killed Docker client can leave its container alive, holding the host-network X11 socket.
    spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
  }
  expect(existsSync(join(dir, "out/voice.json"))).toBe(false);
}, 120_000);

describe("flow-reel compose", () => {
  beforeAll(async () => {
    a = await recordOnce("a");
    b = await recordOnce("b");
  }, 900_000);

  it("writes portable Qwen clips with measured metadata and the same audio on both runs", () => {
    for (const run of [a, b]) {
      expect(run.transcript.voice).toEqual({ adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0, language: "english" });
      run.transcript.steps.forEach((step, index) => {
        expect(step.audio?.file).toBe(`audio/${String(index).padStart(3, "0")}.wav`);
        const file = join(run.reel, step.audio!.file);
        const { streams: [audio] } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
        expect(audio).toMatchObject({ codec_name: "pcm_s16le", channels: 1 });
        expect(step.audio!.durationMs).toBe(Math.round(Number(audio.duration) * 1000));
        expect(step.audio!.durationMs).toBeGreaterThan(0);
        expect(step.audio!.sha256).toBe(createHash("sha256").update(readFileSync(file)).digest("hex"));
      });
      const { streams } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "json", join(run.reel, "video.mp4")], { encoding: "utf8" }));
      expect(streams.map((s: { codec_type: string }) => s.codec_type)).toEqual(["video", "audio"]);
      const audio = streams.find((s: { codec_type: string }) => s.codec_type === "audio");
      expect(Math.abs(Number(audio.duration) * 1000 - run.transcript.video.durationMs)).toBeLessThanOrEqual(1000 / 30);
    }
    expect(a.transcript.steps.map((s) => s.audio)).toEqual(b.transcript.steps.map((s) => s.audio));
  });

  it("loads WebVTT in Chromium with literal text and displays the active caption during playback", async () => {
    for (const run of [a, b]) {
      const { stdout } = await promisify(execFile)("docker", ["run", "--rm", "--init", "--shm-size=1g",
        "--user", `${process.getuid!()}:${process.getgid!()}`,
        "-v", `${run.project.output}:/work`, "-v", `${resolve("test/e2e/player.ts")}:/opt/flow-reel/player.ts:ro`,
        "--entrypoint", "node", image, "/opt/flow-reel/player.ts"]);
      const playback = JSON.parse(stdout);
      expect(playback.cues).toEqual(run.transcript.steps.map((s, i) => ({
        startMs: Math.round(s.startMs), endMs: Math.round(s.endMs),
        text: ["Type <b>Ada</b> & &lt; --> 保存.", "Scroll down and save.", "Open the settings."][i],
      })));
      expect(playback.active).toEqual(["Type <b>Ada</b> & &lt; --> 保存."]);
    }
  });

  it("preserves original comments and writes SRT cues on each run's calibrated timeline", () => {
    for (const run of [a, b]) {
      expect(run.transcript.steps.map((s) => s.comment)).toEqual(COMMENTS);
      const srt = readFileSync(join(run.reel, "captions.srt"), "utf8");
      expect(srt.split("\n\n").filter(Boolean).map((cue) => cue.split("\n")[2])).toEqual([
        "Type &lt;b&gt;Ada&lt;/b&gt; &amp; &amp;lt; --&gt; 保存.", "Scroll down and save.", "Open the settings.",
      ]);
      const { packets } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_packets",
        "-show_entries", "packet=pts_time,duration_time", "-of", "json", join(run.reel, "captions.srt")], { encoding: "utf8" }));
      expect(packets.map((p: { pts_time: string; duration_time: string }) => ({
        startMs: Math.round(Number(p.pts_time) * 1000), durationMs: Math.round(Number(p.duration_time) * 1000),
      }))).toEqual(run.transcript.steps.map((s) => ({ startMs: Math.round(s.startMs), durationMs: Math.round(s.endMs) - Math.round(s.startMs) })));
      expect(readFileSync(join(run.reel, "captions.vtt"), "utf8")).toContain("WEBVTT\n\n");
    }
  });

  it("keeps the 1440p 30 fps capture in the run, dropping no frames, and a 1080p copy in the reel", () => {
    const run = lastRun(a.project);
    const capture = probe(join(run, "record/capture.mp4"));
    expect(capture).toMatchObject({ width: 2560, height: 1440, fps: "30/1" });
    expect(Math.abs(capture.frames - capture.seconds * 30)).toBeLessThanOrEqual(capture.seconds * 30 * 0.01 + 1);
    expect(JSON.parse(readFileSync(join(run, "record/cues.json"), "utf8")).capture.frames).toBe(capture.frames);
    expect(readdirSync(run).sort()).toEqual(["journal.jsonl", "log.txt", "plan", "previous", "record", "reel", "render", "request.json", "scripts", "voice"]);
    expect(readdirSync(join(run, "render")).sort()).toEqual(["render.json", "result.json", "video.mp4"]);
    expect(probe(join(a.reel, "video.mp4"))).toMatchObject({ width: 1920, height: 1080, fps: "30/1" });
  });

  it("writes a valid transcript and event log", () => {
    expect(validateTranscript(a.transcript)).toEqual([]);
    expect(validateSync(a.transcript)).toEqual([]);
    for (const s of a.transcript.steps) expect(s.endMs - s.startMs).toBeGreaterThanOrEqual(s.audio!.durationMs + 200 - 1e-6);
    expect(validateEvents(a.events)).toEqual([]);
    expect(a.events).toMatchObject({ version: 6, autoZoom: true });
    expect(a.transcript.steps).toHaveLength(3);
    expect(a.events.events.map((e) => e.type)).toEqual(["move", "click", "type", "scroll", "move", "click", "sound", "scroll", "move", "click", "sound"]);
    for (const e of a.events.events) if (e.type === "click" || e.type === "type") {
      expect(e.bounds?.width).toBeGreaterThan(0);
      expect(e.bounds?.height).toBeGreaterThan(0);
    }
  });

  it("writes one reel in the output folder, whole according to its manifest (GH-31 decisions 002 and 003)", () => {
    for (const run of [a, b]) {
      expect(readdirSync(run.project.root).sort()).toEqual(["flow-reel.json", "record.log", "reels"]);
      expect(readdirSync(run.project.scripts).sort()).toEqual(["demo.reel.ts", "out"]);
      expect(readdirSync(run.project.output).filter((f) => f !== "captions.png")).toEqual(["demo.reel"]); // the player test's picture
      expect(readdirSync(run.reel).sort()).toEqual([
        "audio", "captions.srt", "captions.vtt", "events.json", "manifest.json", "transcript.json", "video.mp4",
      ]);
      const { errors, differences, manifest } = verifyReel(run.reel);
      expect({ errors, differences }).toEqual({ errors: [], differences: [] });
      expect(manifest).toMatchObject({
        script: { file: "demo.reel.ts", sha256: createHash("sha256").update(readFileSync(join(run.project.scripts, "demo.reel.ts"))).digest("hex") },
        composer: { version: JSON.parse(readFileSync("package.json", "utf8")).version, platform: expect.stringMatching(/^linux\/(amd64|arm64)$/) },
        integration: "playwright", voice: run.transcript.voice,
      });
    }
  });

  it("gives the same steps on two runs, every start within ±150 ms (story decision 009)", () => {
    expect(compareTranscripts(a.transcript, b.transcript)).toEqual({ errors: [], differences: [] });
    expect(spawnSync(process.execPath, ["dist/cli.js", "compare", a.reel,
      b.reel], { encoding: "utf8" }).status).toBe(0);
    expect(b.transcript.steps).toHaveLength(a.transcript.steps.length);
    a.transcript.steps.forEach((s, i) => {
      expect(Math.abs(s.startMs - b.transcript.steps[i].startMs)).toBeLessThanOrEqual(150);
    });
  });

  it("times events on the video's own clock: the marker click shows within 2 frames of its t", () => {
    const click = a.events.events.filter((e) => e.type === "click").at(-1)!;
    expect(Math.abs(firstMagentaMs(join(a.reel, "video.mp4")) - click.t)).toBeLessThanOrEqual(2 * 1000 / 30);
  });

  it("draws a blue ripple at every transformed click on the final delivery clock", () => {
    const plan = planPolish(a.events.events, { viewport: [1920, 1080], source: [2560, 1440], fps: 30,
      frames: Math.round(a.transcript.video.durationMs * 30 / 1000) });
    for (const click of a.events.events.filter((e) => e.type === "click")) {
      const n = Math.ceil(click.t * 30 / 1000 - 1e-9);
      const { x, y } = plan.frame(n).ripples[0];
      const left = Math.max(0, Math.min(1856, Math.round(x) - 32));
      const top = Math.max(0, Math.min(1016, Math.round(y) - 32));
      const raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(a.reel, "video.mp4"), "-vf",
        `select=eq(n\\,${n}),crop=64:64:${left}:${top}`, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
      { maxBuffer: 1 << 20 });
      let blue = 0;
      for (let i = 0; i < raw.length; i += 3) if (raw[i + 2] > 120 && raw[i + 2] > raw[i] * 1.4 && raw[i + 2] > raw[i + 1] * 1.2) blue++;
      expect(blue).toBeGreaterThan(10);
    }
  });

  it("recomposes an unchanged script without voicing, reusing every clip, and keeps flow-reel.json (GH-33)", async () => {
    const config = readFileSync(join(b.project.root, "flow-reel.json"), "utf8");
    const { stderr } = await compose(b.project);
    expect(stderr).toContain("flow-reel: voiced 0 of 3 comments (3 reused)");
    expect(readFileSync(join(b.project.root, "flow-reel.json"), "utf8")).toBe(config);
    const transcript: Transcript = JSON.parse(readFileSync(join(b.reel, "transcript.json"), "utf8"));
    expect(transcript.voice).toEqual(b.transcript.voice);
    expect(transcript.steps.map((s) => s.audio)).toEqual(b.transcript.steps.map((s) => s.audio));
    expect(verifyReel(b.reel)).toMatchObject({ errors: [], differences: [] });
  }, 900_000);
});

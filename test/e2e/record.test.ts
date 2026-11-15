import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOUND_NAMES, type EventLog, validateEvents } from "../../src/composer/schema/events.ts";
import { compareTranscripts } from "../../src/compare.ts";
import { validateSync } from "../../src/composer/schema/sync.ts";
import { type Transcript, validateTranscript } from "../../src/composer/schema/transcript.ts";
import { planPolish } from "../../src/composer/polish.ts";
import { verifyReel } from "../../src/reel.ts";
import { prepareImage } from "./image.ts";

// The whole recorder, in Docker, against a fixture app served from the host's 127.0.0.1 (GH-2 impl.md step 12).
const OUT = resolve("test/e2e/out/record");
const html = readFileSync(resolve("test/e2e/app/index.html"));
let server: Server;
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

interface Run { dir: string; transcript: Transcript; events: EventLog }

// Async: the fixture server lives in this process, so the event loop must stay free while the recording runs.
async function recordOnce(name: string): Promise<Run> {
  const dir = join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "demo.ts"), script(port));
  try {
    const { stderr } = await promisify(execFile)(process.execPath, ["dist/cli.js", "compose", join(dir, "demo.ts")]);
    if (stderr) writeFileSync(join(dir, "record.log"), stderr);
  } catch (error) {
    writeFileSync(join(dir, "record.log"), (error as { stderr?: string }).stderr ?? String(error));
    throw error;
  }
  return {
    dir,
    transcript: JSON.parse(readFileSync(join(dir, "demo.reel/transcript.json"), "utf8")),
    events: JSON.parse(readFileSync(join(dir, "demo.reel/events.json"), "utf8")),
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
  image = prepareImage();
  server = createServer((req, res) => {
    if (req.url === "/delayed") return void setTimeout(() => res.writeHead(200).end("ready"), 350);
    res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
}, 900_000);

afterAll(() => server?.close());

it("records all eight sounds without comments and keeps them in the event log when muted", async () => {
  const dir = join(OUT, "muted-cues");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "demo.ts"), `import { script, Sounds } from "flow-reel";
export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ sound }) => {
  for (const group of Object.values(Sounds)) {
    for (const name of Object.values(group)) {
      sound(name);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
});`);
  const container = `flow-reel-muted-cues-${randomUUID()}`;
  try {
    await promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--shm-size=1g", "--network", "host",
      "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`, image,
      "compose", "/work/demo.ts", "--no-sound"], { timeout: 90_000 });
  } finally {
    spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
  }
  const log = JSON.parse(readFileSync(join(dir, "demo.reel/events.json"), "utf8"));
  expect(validateEvents(log)).toEqual([]);
  expect(log.events.map((e: { name: string }) => e.name)).toEqual(SOUND_NAMES);
  expect(log.events.every((e: { t: number }, i: number) => i === 0 || e.t > log.events[i - 1].t)).toBe(true);
  const { streams } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", join(dir, "demo.reel/video.mp4")], { encoding: "utf8" }));
  expect(streams.map((s: { codec_type: string }) => s.codec_type)).toEqual(["video"]);
  expect(existsSync(join(dir, "demo.reel/work/sound.wav"))).toBe(false);
}, 120_000);

describe("effect words in a composed reel (GH-32)", () => {
  // Composed in the image, with a green image beside the script; no comments, so no voice to wait for.
  const effectsScript = (p: number, autoZoom: boolean) => `import { script } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540], autoZoom: ${autoZoom} }, async ({ page, flash, showFrame, zoomIn, zoomOut }) => {
  await showFrame("img/green.png", 1000, { background: "#0000ff" });
  await page.getByRole("button", { name: "Save" }).zoomIn({ scale: 1.5 }).flash({ color: "#ff0000" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  zoomOut();
  flash();
  await page.getByRole("link", { name: "Settings" }).click();
});`;
  const composeEffects = async (name: string, autoZoom = true) => {
    const dir = join(OUT, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "img"), { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=lime:s=480x540", "-frames:v", "1", join(dir, "img", "green.png")]);
    writeFileSync(join(dir, "demo.ts"), effectsScript(port, autoZoom));
    const container = `flow-reel-${name}-${randomUUID()}`;
    try {
      const { stderr } = await promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--shm-size=1g",
        "--network", "host", "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`, image,
        "compose", "/work/demo.ts"], { timeout: 180_000 });
      if (stderr) writeFileSync(join(dir, "record.log"), stderr);
    } finally {
      spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
    }
    return { dir, reel: join(dir, "demo.reel"), events: JSON.parse(readFileSync(join(dir, "demo.reel/events.json"), "utf8")) as EventLog };
  };
  let first: Awaited<ReturnType<typeof composeEffects>>;
  let second: Awaited<ReturnType<typeof composeEffects>>;
  beforeAll(async () => {
    first = await composeEffects("effects-a");
    second = await composeEffects("effects-b");
  }, 600_000);

  it("logs each effect with its options and the image's hash, in the order the script used them", () => {
    expect(validateEvents(first.events)).toEqual([]);
    expect(first.events.autoZoom).toBe(true);
    const effects = first.events.events.filter((e) => ["flash", "frame", "zoom"].includes(e.type));
    expect(effects.map((e) => e.type === "zoom" ? `zoom ${e.zoom}` : e.type)).toEqual(["frame", "zoom in", "flash", "zoom out", "flash"]);
    expect(effects[0]).toMatchObject({ image: "img/green.png", durationMs: 1000, fit: "contain", background: "#0000ff",
      sha256: createHash("sha256").update(readFileSync(join(first.dir, "img", "green.png"))).digest("hex") });
    expect(effects[1]).toMatchObject({ scale: 1.5, ms: 650, bounds: expect.any(Object) });
    expect(effects[2]).toMatchObject({ color: "#ff0000" });
    const click = first.events.events.find((e) => e.type === "click")!;
    expect(Math.abs(effects[2].t - click.t)).toBeLessThan(1); // logged right after the click
    expect(effects[1].t).toBeLessThan(click.t);
  });

  it("shows the image for its frames, uncovered, and flashes red at the click", () => {
    const raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(first.reel, "video.mp4"), "-vf", "scale=96:54,format=rgb24",
      "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
    const size = 96 * 54 * 3;
    const at = (frame: number, x: number, y: number) => [...raw.subarray(frame * size + (y * 96 + x) * 3, frame * size + (y * 96 + x) * 3 + 3)];
    const [frame, , flash] = first.events.events.filter((e) => ["flash", "frame", "zoom"].includes(e.type));
    const start = Math.round(frame.t * 30 / 1000);
    for (const f of [start, start + 29]) {
      expect(at(f, 48, 27)[1]).toBeGreaterThan(200); // the green image in the middle
      expect(at(f, 2, 27)[2]).toBeGreaterThan(200);  // the blue background beside it
    }
    expect(at(start + 30, 48, 27)[1] > 200 && at(start + 30, 48, 27)[0] < 60).toBe(false);
    const red = Math.ceil(flash.t * 30 / 1000 - 1e-9);
    expect(at(red, 2, 2)[0]).toBeGreaterThan(200);
    expect(at(red, 2, 2)[1]).toBeLessThan(60);
  });

  it("verifies, and gives the same effects on a second compose, which compare checks", () => {
    expect(verifyReel(first.reel)).toMatchObject({ errors: [], differences: [] });
    const result = spawnSync(process.execPath, ["dist/cli.js", "compare", first.reel, second.reel], { encoding: "utf8" });
    expect(result).toMatchObject({ status: 0, stdout: "Reels match (step starts and effects within 150 ms).\n" });
  });

  it("records autoZoom: false and draws no automatic zoom then", async () => {
    const off = await composeEffects("effects-off", false);
    expect(off.events.autoZoom).toBe(false);
    // The Settings click after zoomOut would zoom automatically; with autoZoom off the picture stays full.
    const out = off.events.events.find((e) => e.type === "zoom" && e.zoom === "out")!;
    const click = off.events.events.findLast((e) => e.type === "click")!;
    expect(click.t).toBeGreaterThan(out.t);
    const plan = planPolish(off.events.events, { viewport: [960, 540], source: [1280, 720], fps: 30,
      frames: Math.ceil(click.t * 30 / 1000) + 90, autoZoom: off.events.autoZoom });
    for (let n = Math.ceil((out.t + 800) * 30 / 1000); n < plan.frames; n++) expect(plan.frame(n).zoom).toBe(1);
  }, 240_000);
});

it("captures the settled response while keeping the callback finish time", async () => {
  const dir = join(OUT, "settled");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "demo.ts"), `import { script } from "flow-reel";
export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ page }) => {
  await page.evaluate(() => {
    void fetch("/delayed").then(() => document.body.classList.add("flash"));
  });
});`);
  const container = `flow-reel-settled-${randomUUID()}`;
  try {
    await promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--shm-size=1g", "--network", "host",
      "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`, image,
      "compose", "/work/demo.ts"], { timeout: 90_000 });
  } finally {
    spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
  }
  const transcript: Transcript = JSON.parse(readFileSync(join(dir, "demo.reel/transcript.json"), "utf8"));
  const step = transcript.steps[0];
  expect(step.endMs - step.actionEndMs).toBeGreaterThanOrEqual(900);
  const painted = firstMagentaMs(join(dir, "demo.reel/video.mp4"));
  expect(painted).toBeGreaterThan(step.actionEndMs);
  expect(painted).toBeLessThan(step.endMs);
}, 120_000);

it("fails the command without publishing a successful transcript when TTS assets are missing", async () => {
  const dir = join(OUT, "missing-assets");
  rmSync(dir, { recursive: true, force: true });
  const assets = join(dir, "empty-model");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(dir, "demo.ts"), script(port, [960, 540]));
  const container = `flow-reel-missing-tts-${randomUUID()}`;
  try {
    await expect(promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--shm-size=1g", "--network", "host",
      "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`,
      "-v", `${assets}:/opt/flow-reel/tts-model:ro`, image, "compose", "/work/demo.ts"], { timeout: 90_000 }))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("Qwen TTS failed") });
  } finally {
    // A killed Docker client can leave its container alive, holding the host-network X11 socket.
    spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
  }
  expect(existsSync(join(dir, "demo.reel"))).toBe(false);
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
        const file = join(run.dir, "demo.reel", step.audio!.file);
        const { streams: [audio] } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
        expect(audio).toMatchObject({ codec_name: "pcm_s16le", channels: 1 });
        expect(step.audio!.durationMs).toBe(Math.round(Number(audio.duration) * 1000));
        expect(step.audio!.durationMs).toBeGreaterThan(0);
        expect(step.audio!.sha256).toBe(createHash("sha256").update(readFileSync(file)).digest("hex"));
      });
      const { streams } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "json", join(run.dir, "demo.reel/video.mp4")], { encoding: "utf8" }));
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
        "-v", `${run.dir}:/work`, "-v", `${resolve("test/e2e/player.ts")}:/opt/flow-reel/player.ts:ro`,
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
      const srt = readFileSync(join(run.dir, "demo.reel/captions.srt"), "utf8");
      expect(srt.split("\n\n").filter(Boolean).map((cue) => cue.split("\n")[2])).toEqual([
        "Type &lt;b&gt;Ada&lt;/b&gt; &amp; &amp;lt; --&gt; 保存.", "Scroll down and save.", "Open the settings.",
      ]);
      const { packets } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_packets",
        "-show_entries", "packet=pts_time,duration_time", "-of", "json", join(run.dir, "demo.reel/captions.srt")], { encoding: "utf8" }));
      expect(packets.map((p: { pts_time: string; duration_time: string }) => ({
        startMs: Math.round(Number(p.pts_time) * 1000), durationMs: Math.round(Number(p.duration_time) * 1000),
      }))).toEqual(run.transcript.steps.map((s) => ({ startMs: Math.round(s.startMs), durationMs: Math.round(s.endMs) - Math.round(s.startMs) })));
      expect(readFileSync(join(run.dir, "demo.reel/captions.vtt"), "utf8")).toContain("WEBVTT\n\n");
    }
  });

  it("writes a 1440p 30 fps master and a 1080p copy, dropping no frames", () => {
    const master = probe(join(a.dir, "demo.reel/work/master.mp4"));
    expect(master).toMatchObject({ width: 2560, height: 1440, fps: "30/1" });
    const capture = probe(join(a.dir, "demo.reel/work/capture.mp4"));
    expect(master.frames).toBeGreaterThan(capture.frames);
    expect(Math.abs(capture.frames - capture.seconds * 30)).toBeLessThanOrEqual(capture.seconds * 30 * 0.01 + 1);
    expect(Math.abs(master.frames - master.seconds * 30)).toBeLessThanOrEqual(master.seconds * 30 * 0.01 + 1);
    expect(probe(join(a.dir, "demo.reel/video.mp4"))).toMatchObject({ width: 1920, height: 1080, fps: "30/1" });
    expect(readFileSync(join(a.dir, "demo.reel/work/.gitignore"), "utf8")).toBe("*\n");
  });

  it("writes a valid transcript and event log", () => {
    expect(validateTranscript(a.transcript)).toEqual([]);
    expect(validateSync(a.transcript)).toEqual([]);
    for (const s of a.transcript.steps) expect(s.endMs - s.startMs).toBeGreaterThanOrEqual(s.audio!.durationMs + 200 - 1e-6);
    expect(validateEvents(a.events)).toEqual([]);
    expect(a.events).toMatchObject({ version: 4, autoZoom: true });
    expect(a.transcript.steps).toHaveLength(3);
    expect(a.events.events.map((e) => e.type)).toEqual(["move", "click", "type", "scroll", "move", "click", "sound", "scroll", "move", "click", "sound"]);
    for (const e of a.events.events) if (e.type === "click" || e.type === "type") {
      expect(e.bounds?.width).toBeGreaterThan(0);
      expect(e.bounds?.height).toBeGreaterThan(0);
    }
  });

  it("writes one reel beside the script, whole according to its manifest (GH-31 decisions 001-003)", () => {
    for (const run of [a, b]) {
      expect(readdirSync(run.dir).filter((f) => !["record.log", "captions.png"].includes(f)).sort()).toEqual(["demo.reel", "demo.ts", "flow-reel.json"]);
      expect(readdirSync(join(run.dir, "demo.reel")).sort()).toEqual([
        "audio", "captions.srt", "captions.vtt", "events.json", "manifest.json", "transcript.json", "video.mp4", "work",
      ]);
      const { errors, differences, manifest } = verifyReel(join(run.dir, "demo.reel"));
      expect({ errors, differences }).toEqual({ errors: [], differences: [] });
      expect(manifest).toMatchObject({
        script: { file: "demo.ts", sha256: createHash("sha256").update(readFileSync(join(run.dir, "demo.ts"))).digest("hex") },
        composer: { version: JSON.parse(readFileSync("package.json", "utf8")).version, platform: expect.stringMatching(/^linux\/(amd64|arm64)$/) },
        integration: "playwright", voice: run.transcript.voice,
      });
    }
  });

  it("recomposes an unchanged script without voicing, reusing every clip, and keeps an existing flow-reel.json (GH-33)", async () => {
    // The first compose saved its settings beside the script (GH-33 decisions 001 and 005).
    expect(JSON.parse(readFileSync(join(b.dir, "flow-reel.json"), "utf8"))).toEqual({ version: 1, integration: "playwright",
      voice: { adapter: "qwen3-tts-0.6b", speaker: "Ryan", language: "english" } });
    const dir = join(OUT, "recompose");
    rmSync(dir, { recursive: true, force: true });
    cpSync(b.dir, dir, { recursive: true });
    writeFileSync(join(dir, "flow-reel.json"), '{ "version": 1 }\n');
    const { stderr } = await promisify(execFile)(process.execPath, ["dist/cli.js", "compose", join(dir, "demo.ts")]);
    writeFileSync(join(dir, "record.log"), stderr);
    expect(stderr).toContain("flow-reel: voiced 0 of 3 comments (3 reused)");
    expect(readFileSync(join(dir, "flow-reel.json"), "utf8")).toBe('{ "version": 1 }\n');
    const transcript: Transcript = JSON.parse(readFileSync(join(dir, "demo.reel/transcript.json"), "utf8"));
    expect(transcript.voice).toEqual(b.transcript.voice);
    expect(transcript.steps.map((s) => s.audio)).toEqual(b.transcript.steps.map((s) => s.audio));
    expect(verifyReel(join(dir, "demo.reel"))).toMatchObject({ errors: [], differences: [] });
  }, 900_000);

  it("gives the same steps on two runs, every start within ±150 ms (story decision 009)", () => {
    expect(compareTranscripts(a.transcript, b.transcript)).toEqual({ errors: [], differences: [] });
    expect(spawnSync(process.execPath, ["dist/cli.js", "compare", join(a.dir, "demo.reel"),
      join(b.dir, "demo.reel")], { encoding: "utf8" }).status).toBe(0);
    expect(b.transcript.steps).toHaveLength(a.transcript.steps.length);
    a.transcript.steps.forEach((s, i) => {
      expect(Math.abs(s.startMs - b.transcript.steps[i].startMs)).toBeLessThanOrEqual(150);
    });
  });

  it("times events on the video's own clock: the marker click shows within 2 frames of its t", () => {
    const click = a.events.events.filter((e) => e.type === "click").at(-1)!;
    const work = join(a.dir, "demo.reel/work");
    const cut = JSON.parse(readFileSync(join(work, "master.json"), "utf8")).startMs;
    expect(Math.abs(firstMagentaMs(join(work, "master.mp4")) - cut - click.t)).toBeLessThanOrEqual(2 * 1000 / 30);
  });

  it("draws a blue ripple at every transformed click on the final delivery clock", () => {
    const plan = planPolish(a.events.events, { viewport: [1920, 1080], source: [2560, 1440], fps: 30,
      frames: Math.round(a.transcript.video.durationMs * 30 / 1000) });
    for (const click of a.events.events.filter((e) => e.type === "click")) {
      const n = Math.ceil(click.t * 30 / 1000 - 1e-9);
      const { x, y } = plan.frame(n).ripples[0];
      const left = Math.max(0, Math.min(1856, Math.round(x) - 32));
      const top = Math.max(0, Math.min(1016, Math.round(y) - 32));
      const raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(a.dir, "demo.reel/video.mp4"), "-vf",
        `select=eq(n\\,${n}),crop=64:64:${left}:${top}`, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
      { maxBuffer: 1 << 20 });
      let blue = 0;
      for (let i = 0; i < raw.length; i += 3) if (raw[i + 2] > 120 && raw[i + 2] > raw[i] * 1.4 && raw[i + 2] > raw[i + 1] * 1.2) blue++;
      expect(blue).toBeGreaterThan(10);
    }
  });
});

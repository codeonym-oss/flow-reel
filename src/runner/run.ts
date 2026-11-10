// One recording, inside the container: load the script, open the page, record while the steps run, then write the
// 1080p video, transcript.json and events.json beside the script, and the master in .flow-reel/ (decision 006).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Step } from "../index.ts";
import { type RunnerEvent, validateEvents } from "../schema/events.ts";
import { type Transcript, type TranscriptStep, validateTranscript } from "../schema/transcript.ts";
import { launchBrowser } from "./browser.ts";
import { renderCaptions } from "./captions.ts";
import { screenFor, startDisplay } from "./display.ts";
import { loadDemo } from "./load.ts";
import { trackNetwork } from "./network.ts";
import { FPS, downscale, durationMs, firstFrameOfColour, startRecording } from "./recorder.ts";
import { wrapPage } from "./wrap.ts";

// A still moment before the first step and after the last; a short settle before each step, so its start doesn't
// depend on how long the network-idle check took (story decision 009).
const LEAD_IN_MS = 500;
const TAIL_MS = 500;
const STEP_SETTLE_MS = 100;
// More than this share of the wall-clock recording missing from the master means ffmpeg fell behind (decision 007).
const MAX_SHORTFALL = 0.03;
// A pixel takes about 100 ms to reach the master after the runner acts (drawing, Xvfb, x11grab), and it varies by
// machine. So each run flashes a full-screen marker, finds its first frame in the master, and shifts every time by
// the measured delay; demo.mp4 starts at CUT_MS, after the marker.
const MARK_AT_MS = 200;
const MARK_HOLD_MS = 200;
const CUT_MS = 1000;
const MARK_RGB: [number, number, number] = [0, 255, 0];

export async function record(scriptPath: string): Promise<void> {
  const demo = await loadDemo(scriptPath);
  const dir = dirname(scriptPath);
  const name = basename(scriptPath).replace(/\.[cm]?ts$/, "");
  const work = join(dir, ".flow-reel");
  mkdirSync(join(work, name), { recursive: true });
  // Ignores the whole folder without touching the app's own .gitignore.
  if (!existsSync(join(work, ".gitignore"))) writeFileSync(join(work, ".gitignore"), "*\n");
  const out = {
    master: join(work, name, "master.mp4"),
    video: join(dir, `${name}.mp4`),
    transcript: join(dir, `${name}.transcript.json`),
    events: join(dir, `${name}.events.json`),
    srt: join(dir, `${name}.srt`),
    vtt: join(dir, `${name}.vtt`),
  };
  const { viewport, url } = demo.options;

  const display = await startDisplay(viewport);
  try {
    const { context, page } = await launchBrowser(viewport);
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      const network = trackNetwork(page);
      await page.mouse.move(viewport[0] / 2, viewport[1] / 2);
      await page.locator("body").boundingBox(); // warms up the round-trip the first step would otherwise pay for

      const recording = await startRecording(out.master, screenFor(viewport));
      const steps: TranscriptStep[] = [];
      const events: RunnerEvent[] = [];
      const until = (ms: number) => sleep(Math.max(0, ms - recording.now()));
      await until(MARK_AT_MS);
      const markMs = recording.now();
      await page.evaluate((rgb) => {
        const mark = document.createElement("div");
        mark.id = "__flow_reel_mark";
        mark.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:rgb(${rgb})`;
        document.documentElement.append(mark);
      }, MARK_RGB.join(","));
      await until(markMs + MARK_HOLD_MS);
      await page.evaluate(() => document.getElementById("__flow_reel_mark")?.remove());
      await until(CUT_MS + LEAD_IN_MS);
      const step: Step = async (narration, action) => {
        const settle = recording.now() + STEP_SETTLE_MS;
        if (!(await network.idle())) console.warn(`step ${steps.length}: the page was still loading after 10 s; going on`);
        await until(settle);
        const startMs = Math.round(recording.now());
        try {
          await action();
        } catch (e) {
          throw new Error(`step ${steps.length} ("${narration}") failed: ${(e as Error).message}`, { cause: e });
        }
        const actionEndMs = Math.round(recording.now());
        steps.push({ index: steps.length, narration, startMs, actionEndMs, endMs: actionEndMs });
      };
      let ranMs = 0;
      try {
        await demo.body({ page: wrapPage(page, { clock: recording, events, fps: FPS, viewport }), step });
        await sleep(TAIL_MS);
      } finally {
        ranMs = await recording.stop();
      }
      const masterMs = durationMs(out.master);
      if (masterMs < ranMs * (1 - MAX_SHORTFALL)) {
        const behind = Math.round((1 - masterMs / ranMs) * 100);
        throw new Error(`the screen capture fell ${behind} % behind real time (${masterMs} ms of video for ` +
          `${Math.round(ranMs)} ms recorded), so its timing can't be trusted. The machine is too busy: close other ` +
          "apps or containers and record again, or record on a machine with more CPU.");
      }

      const markFrameMs = firstFrameOfColour(out.master, MARK_RGB, CUT_MS);
      if (markFrameMs === undefined || markFrameMs < markMs) throw new Error("the timing marker isn't in the master");
      // demo.mp4 starts on the master frame nearest CUT_MS in on-screen time; times move from the runner's clock to it.
      const frameMs = 1000 / FPS;
      const startMs = markFrameMs + Math.round((CUT_MS - markMs) / frameMs) * frameMs;
      const shift = markFrameMs - markMs - startMs;
      for (const s of steps) {
        s.startMs = Math.round(s.startMs + shift);
        s.actionEndMs = Math.round(s.actionEndMs + shift);
        s.endMs = Math.round(s.endMs + shift);
      }
      for (const e of events) e.t += shift;
      // Where demo.mp4, and so every time in the JSON files, starts in the master (for the render tickets).
      writeFileSync(join(work, name, "master.json"), `${JSON.stringify({ startMs })}\n`);

      downscale(out.master, out.video, viewport, startMs);
      const transcript: Transcript = {
        version: 1,
        script: basename(scriptPath),
        video: { file: basename(out.video), width: viewport[0], height: viewport[1], fps: FPS, durationMs: durationMs(out.video) },
        steps,
      };
      writeChecked(out.transcript, transcript, validateTranscript(transcript));
      const captions = renderCaptions(transcript.steps);
      writeFileSync(out.srt, captions.srt, "utf8");
      writeFileSync(out.vtt, captions.vtt, "utf8");
      const log = { version: 1 as const, events };
      writeChecked(out.events, log, validateEvents(log));
    } finally {
      await context.close();
    }
  } finally {
    display.kill();
  }
}

function writeChecked(file: string, value: unknown, errors: string[]) {
  if (errors.length) throw new Error(`${basename(file)} is invalid:\n  ${errors.join("\n  ")}`);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

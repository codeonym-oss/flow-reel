// The first phase: replays a script through the integration while capturing the display, and writes the capture and the
// cue sheet. It runs in the composer's container; it is the only phase that runs the script.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Brand, checkBrandFiles } from "../cards/brand.ts";
import { overlayRequest } from "../cards/overlays.ts";
import { cardRequest, cardWords } from "../cards/words.ts";
import { zoomOutEvent, zoomOutSettings } from "../effects.ts";
import { screenFor, startDisplay } from "../media/display.ts";
import { FPS, durationMs, firstFrameOfColour, startRecording, videoFrames } from "../media/recording.ts";
import type { Integration, Session } from "../ports.ts";
import type { Report } from "../progress.ts";
import type { CueSheet } from "../schema/cues.ts";
import type { ComposerEvent } from "../schema/events.ts";
import { CAPTURE_FILE, CUES_FILE } from "../schema/files.ts";
import { soundLogger } from "../sounds.ts";
import { stepTimer } from "../steps.ts";

// A still moment before the first step and after the last (story decision 009).
const LEAD_IN_MS = 500;
const TAIL_MS = 500;
// More than this share of the wall-clock recording missing from the capture means ffmpeg fell behind (decision 007).
const MAX_SHORTFALL = 0.03;
// A pixel takes about 100 ms to reach the capture after the composer acts (drawing, Xvfb, x11grab), and it varies by
// machine. So each run flashes a full-screen marker, finds its first frame in the capture, and shifts every time by
// the measured delay; the video starts at CUT_MS, after the marker.
const MARK_AT_MS = 200;
const MARK_HOLD_MS = 200;
const CUT_MS = 1000;
const MARK_RGB: [number, number, number] = [0, 255, 0];

export interface RecordJob {
  /** The scripts folder; the script's files and the brand's are inside it. */
  scriptsDir: string;
  /** The script's path in the scripts folder, with forward slashes. */
  script: string;
  /** How cards and overlays look (GH-76 decision 006); its paths are relative to the scripts folder. */
  brand: Brand;
  /** Where the capture and the cue sheet go. */
  out: string;
}

const ARCH: Record<string, string> = { x64: "amd64", arm64: "arm64" };

export async function record({ scriptsDir, script: path, brand, out }: RecordJob, integration: Integration, report: Report): Promise<void> {
  const file = join(scriptsDir, path);
  const script = await integration.load(file);
  checkBrandFiles(scriptsDir, brand);
  const { viewport } = script;
  const capture = join(out, CAPTURE_FILE);
  const display = await startDisplay(viewport);
  let replayed: Awaited<ReturnType<typeof replay>>;
  try {
    const session = await script.open();
    try { replayed = await replay(session, { capture, viewport, scriptsDir, dir: dirname(file), brand, report }); }
    finally { await session.close(); }
  } finally {
    display.kill();
  }
  const { steps, events, cutMs } = replayed;
  const cues: CueSheet = {
    version: 1,
    script: { file: path, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") },
    integration: integration.name,
    platform: `linux/${ARCH[process.arch] ?? process.arch}`,
    viewport, fps: FPS, autoZoom: script.autoZoom,
    capture: { file: CAPTURE_FILE, frames: videoFrames(capture), cutMs },
    steps, events,
  };
  writeFileSync(join(out, CUES_FILE), `${JSON.stringify(cues, null, 2)}\n`);
}

/** Replays the open script while capturing; its times come back on the video's clock, `cutMs` into the capture. */
async function replay(session: Session, { capture, viewport, scriptsDir, dir, brand, report }: { capture: string;
  viewport: [number, number]; scriptsDir: string; dir: string; brand: Brand; report: Report }) {
  const events: ComposerEvent[] = [];
  const recording = await startRecording(capture, screenFor(viewport));
  const until = (ms: number) => sleep(Math.max(0, ms - recording.now()));
  await until(MARK_AT_MS);
  const markMs = recording.now();
  await session.showMarker(MARK_RGB);
  await until(markMs + MARK_HOLD_MS);
  await session.hideMarker();
  await until(CUT_MS + LEAD_IN_MS);
  const timer = stepTimer({ clock: recording, idle: () => session.idle(), opened: (step) => report({ type: "step", ...step }) });
  let ranMs = 0;
  try {
    await session.run({ clock: recording, events, fps: FPS, comment: timer.comment, action: timer.action,
      sound: soundLogger(recording, events),
      speedUp: (factor, run) => timer.speedUp(factor, run, events),
      skip: (run, options) => timer.skip(run, options, events),
      checkEffect: timer.outsideSkip,
      // A card is an action of its step, inserted into the video (GH-76 decision 002).
      card: cardWords(async (word, args) => {
        timer.outsideStretch(`card.${word}`);
        const request = cardRequest(word, args, { root: scriptsDir, dir }, brand);
        await timer.action(async () => { events.push({ t: recording.now(), ...request }); });
      }),
      // An overlay is an action of its step, shown until the script's next action (GH-76 decision 007).
      async overlay(kind, props, options, bounds) {
        const word = `${kind}()`;
        const request = overlayRequest(kind, word, props, options, brand);
        await timer.overlay(kind, (t) => ({ t, type: "overlay", overlay: kind, ...request, durationMs: 0 }), events, bounds && (async () => {
          const box = await bounds();
          if (!box) throw new Error(`${word}: the element has no box on the page; is it visible?`);
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
        }));
      },
    });
    // A zoom the script never zoomed out of eases out as the script ends (story decision 011).
    const lastZoom = events.findLast((e) => e.type === "zoom");
    if (lastZoom?.type === "zoom" && lastZoom.zoom === "in") {
      events.push(zoomOutEvent(recording.now(), zoomOutSettings()));
    }
    await timer.finish();
    await sleep(TAIL_MS);
  } finally {
    ranMs = await recording.stop();
  }
  const captureMs = durationMs(capture);
  if (captureMs < ranMs * (1 - MAX_SHORTFALL)) {
    const behind = Math.round((1 - captureMs / ranMs) * 100);
    throw new Error(`the screen capture fell ${behind} % behind real time (${captureMs} ms of video for ` +
      `${Math.round(ranMs)} ms recorded), so its timing can't be trusted. The machine is too busy: close other ` +
      "apps or containers and compose again, or compose on a machine with more CPU.");
  }

  const markFrameMs = firstFrameOfColour(capture, MARK_RGB, CUT_MS);
  if (markFrameMs === undefined || markFrameMs < markMs) throw new Error("the timing marker isn't in the capture");
  // The video starts on the capture frame nearest CUT_MS in on-screen time; times move from the composer's clock to it.
  const frameMs = 1000 / FPS;
  const cutMs = markFrameMs + Math.round((CUT_MS - markMs) / frameMs) * frameMs;
  const shift = markFrameMs - markMs - cutMs;
  for (const s of timer.steps) {
    s.startMs = Math.round(s.startMs + shift);
    s.actionEndMs = Math.round(s.actionEndMs + shift);
    s.endMs = Math.round(s.endMs + shift);
  }
  for (const e of events) e.t += shift;
  return { steps: timer.steps, events, cutMs };
}

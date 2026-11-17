// Composes one script, inside the container: load it, replay it through the integration while recording the
// display, then voice, render and hand the results to the reel store.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { CardPainter, Integration, ReelStore, Voice } from "./ports.ts";
import { type ComposerEvent, validateEvents } from "./schema/events.ts";
import { type Transcript } from "./schema/transcript.ts";
import { validateSync } from "./schema/sync.ts";
import { renderCaptions } from "./captions.ts";
import { screenFor, startDisplay } from "./media/display.ts";
import { FPS, durationMs, firstFrameOfColour, startRecording } from "./media/recording.ts";
import { renderTimeline, videoFrames } from "./media/render.ts";
import { soundLogger } from "./sounds.ts";
import { stepTimer } from "./steps.ts";
import { dropSkipped, planTimeline, retimeEvents } from "./timeline.ts";
import { voiceSteps } from "./voicing.ts";
import { frameRequest, zoomOutEvent, zoomOutSettings } from "./effects.ts";
import { checkBrandFiles, themeFor } from "./cards/brand.ts";
import { cardRequest, cardWords } from "./cards/words.ts";
import { type CardJob, renderCards } from "./media/cards.ts";
import { readConfig } from "../settings.ts";

// A still moment before the first step and after the last (story decision 009).
const LEAD_IN_MS = 500;
const TAIL_MS = 500;
// More than this share of the wall-clock recording missing from the master means ffmpeg fell behind (decision 007).
const MAX_SHORTFALL = 0.03;
// A pixel takes about 100 ms to reach the master after the composer acts (drawing, Xvfb, x11grab), and it varies by
// machine. So each run flashes a full-screen marker, finds its first frame in the master, and shifts every time by
// the measured delay; the video starts at CUT_MS, after the marker.
const MARK_AT_MS = 200;
const MARK_HOLD_MS = 200;
const CUT_MS = 1000;
const MARK_RGB: [number, number, number] = [0, 255, 0];

export interface ComposeOptions {
  integration: Integration;
  voice: Voice;
  store: ReelStore;
  /** Draws the cards' pages (GH-76 decision 003). */
  painter: CardPainter;
  /** The package version, for the manifest. */
  composerVersion: string;
  /** Where the reel goes; beside the script when omitted. */
  outDir?: string;
  sound?: boolean;
}

const ARCH: Record<string, string> = { x64: "amd64", arm64: "arm64" };

export async function compose(scriptPath: string, { integration, voice, store, painter, composerVersion, outDir, sound }: ComposeOptions): Promise<void> {
  const script = await integration.load(scriptPath);
  const scriptDir = dirname(scriptPath);
  // The brand (GH-76 decision 006): flow-reel.json beside the script, checked on the host; its files are checked here.
  const brand = readConfig(scriptDir)?.brand ?? {};
  checkBrandFiles(scriptDir, brand);
  const reel = store.open(scriptPath, outDir);
  const out = reel.work;
  const { viewport } = script;
  const events: ComposerEvent[] = [];
  // Each showFrame's image, in the order the frame events were logged.
  const imageFiles: string[] = [];
  let steps: ReturnType<typeof stepTimer>["steps"] = [];

  let deliveryCutMs = 0;
  const display = await startDisplay(viewport);
  try {
    const session = await script.open();
    try {
      const recording = await startRecording(out.capture, screenFor(viewport));
      const until = (ms: number) => sleep(Math.max(0, ms - recording.now()));
      await until(MARK_AT_MS);
      const markMs = recording.now();
      await session.showMarker(MARK_RGB);
      await until(markMs + MARK_HOLD_MS);
      await session.hideMarker();
      await until(CUT_MS + LEAD_IN_MS);
      const timer = stepTimer({ clock: recording, idle: () => session.idle() });
      steps = timer.steps;
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
            const request = cardRequest(word, args, scriptDir, brand);
            await timer.action(async () => { events.push({ t: recording.now(), ...request }); });
          }),
          async showFrame(image, durationMs, options) {
            timer.outsideStretch("showFrame");
            const request = frameRequest(scriptDir, image, durationMs, options);
            await timer.action(async () => {
              events.push({ t: recording.now(), ...request.event });
              imageFiles.push(request.file);
            });
          } });
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
      const masterMs = durationMs(out.capture);
      if (masterMs < ranMs * (1 - MAX_SHORTFALL)) {
        const behind = Math.round((1 - masterMs / ranMs) * 100);
        throw new Error(`the screen capture fell ${behind} % behind real time (${masterMs} ms of video for ` +
          `${Math.round(ranMs)} ms recorded), so its timing can't be trusted. The machine is too busy: close other ` +
          "apps or containers and record again, or record on a machine with more CPU.");
      }

      const markFrameMs = firstFrameOfColour(out.capture, MARK_RGB, CUT_MS);
      if (markFrameMs === undefined || markFrameMs < markMs) throw new Error("the timing marker isn't in the master");
      // The video starts on the master frame nearest CUT_MS in on-screen time; times move from the composer's clock to it.
      const frameMs = 1000 / FPS;
      const startMs = markFrameMs + Math.round((CUT_MS - markMs) / frameMs) * frameMs;
      const shift = markFrameMs - markMs - startMs;
      for (const s of steps) {
        s.startMs = Math.round(s.startMs + shift);
        s.actionEndMs = Math.round(s.actionEndMs + shift);
        s.endMs = Math.round(s.endMs + shift);
      }
      for (const e of events) e.t += shift;
      // Where the video, and so every time in the JSON files, starts in the master (for the render tickets).
      writeFileSync(out.masterInfo, `${JSON.stringify({ startMs })}\n`);

      deliveryCutMs = startMs;
    } finally {
      await session.close();
    }
  } finally {
    display.kill();
  }

  // CPU synthesis starts only after capture, browser and display have finished.
  const voiced = await voiceSteps(steps, reel.audioDir, voice, reel.previous);
  if (voiced.voiced + voiced.reused) {
    console.error(`flow-reel: voiced ${voiced.voiced} of ${voiced.voiced + voiced.reused} comments (${voiced.reused} reused)`);
  }
  const images = events.flatMap((e) => e.type === "frame" ? [e] : []).map((e, i) =>
    ({ t: e.t, durationMs: e.durationMs, file: imageFiles[i], fit: e.fit, background: e.background }));
  const speedUps = events.flatMap((e) => e.type === "speed" ? [{ t: e.t, durationMs: e.durationMs, factor: e.factor }] : []);
  // Nothing inside a skip is seen, so its events go (GH-62 decision 004).
  const seen = dropSkipped(events);
  const skipEvents = seen.flatMap((e) => e.type === "skip" ? [e] : []);
  const cardEvents = seen.flatMap((e) => e.type === "card" ? [e] : []);
  const timeline = planTimeline(voiced.steps, { fps: FPS, frames: videoFrames(out.capture), cutMs: deliveryCutMs, images, speedUps,
    skips: skipEvents.map(({ t, durationMs }) => ({ t, durationMs })), cards: cardEvents.map(({ t, ms }) => ({ t, ms })) });
  const log = { version: 6 as const, autoZoom: script.autoZoom, events: retimeEvents(seen, timeline) };
  const eventErrors = validateEvents(log);
  if (eventErrors.length) throw new Error(`recording events are invalid:\n  ${eventErrors.join("\n  ")}`);
  // Chapters are numbered once the script has run (GH-76 decision 002).
  const chapters = cardEvents.filter((e) => e.card === "chapter");
  const jobs = timeline.cards.map(({ id, frame, frames }): CardJob => {
    const index = Number(id.replace(/^\D+/, ""));
    if (id.startsWith("skip")) {
      const skip = skipEvents[index];
      return { id, kind: "skip", props: { label: skip.label, style: skip.style, durationMs: skip.durationMs },
        theme: themeFor(brand.theme ?? "ink", brand), enter: "fade", exit: "fade", frame, frames };
    }
    const card = cardEvents[index];
    const number = chapters.indexOf(card) + 1;
    return { id, kind: card.card, props: card.props, ...(card.card === "custom" ? { page: card.files[0].path } : {}),
      theme: themeFor(card.theme, brand), enter: card.enter, exit: card.exit, frame, frames,
      ...(number ? { chapter: { number, total: chapters.length } } : {}) };
  });
  const clips = await renderCards(jobs, { capture: out.capture, work: dirname(out.master), scriptDir, viewport, fps: FPS, brand, painter });
  renderTimeline({ capture: out.capture, master: out.master, video: out.stagedVideo,
    voice: out.voiceBus, audioDir: reel.audioRoot, viewport, timeline, clips, events: log.events, sound, autoZoom: script.autoZoom });
  const transcript: Transcript = {
    version: 2,
    script: basename(scriptPath),
    video: { file: reel.videoFile, width: viewport[0], height: viewport[1], fps: FPS, durationMs: durationMs(out.stagedVideo) },
    voice: voiced.voice, steps: timeline.steps,
  };
  const errors = validateSync(transcript);
  if (errors.length) throw new Error(`recording is invalid:\n  ${errors.join("\n  ")}`);
  reel.commit({ transcript, events: log, captions: renderCaptions(transcript.steps), about: {
    script: { file: basename(scriptPath), sha256: createHash("sha256").update(readFileSync(scriptPath)).digest("hex") },
    composer: { version: composerVersion, platform: `linux/${ARCH[process.arch] ?? process.arch}` },
    integration: integration.name,
    voice: voiced.voice,
  } });
}

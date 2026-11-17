// Times a script's steps on the recording's clock (story decision 009 of GH-1, GH-30 decision 001). A comment opens a
// step; the step starts with the next action, after the app stops loading and settles, and ends when the following
// step is due, after the app stops loading and settles again. A comment with no action before the next comment is
// a step of its own, with no action.
import { setTimeout as sleep } from "node:timers/promises";
import { skipSettings, speedFactor } from "./effects.ts";
import type { Stage } from "./ports.ts";
import type { Bounds, ComposerEvent, OverlayEvent } from "./schema/events.ts";
import type { TranscriptStep } from "./schema/transcript.ts";

// A short settle before each step, so its start doesn't depend on how long the idle check took.
const STEP_SETTLE_MS = 100;

export interface StepTimerOptions {
  clock: { now(): number };
  idle(): Promise<boolean>;
  sleep?: (ms: number) => Promise<unknown>;
  warn?: (message: string) => void;
}

export function stepTimer({ clock, idle, sleep: wait = sleep, warn = console.warn }: StepTimerOptions) {
  const steps: TranscriptStep[] = [];
  const queued: string[] = [];
  let open: { comment?: string; startMs: number; actionEndMs: number } | undefined;
  // Overlays shown and not yet closed: each closes when the script's next action starts (GH-76 decision 007).
  const overlays: { durationMs: number; t: number }[] = [];
  const closeOverlays = () => {
    for (const o of overlays.splice(0)) o.durationMs = Math.round(clock.now() - o.t);
  };
  // The word whose stretch is running: inside it, only actions (GH-61 decision 004). The stretch is an action itself,
  // so an action failing inside it lets the stretch name the step, once.
  let stretch: string | undefined;
  const until = (ms: number) => wait(Math.max(0, ms - clock.now()));
  const settled = async () => {
    if (!(await idle())) warn(`step ${steps.length}: the page was still loading after 10 s; going on`);
  };

  async function start(comment: string | undefined) {
    const settle = clock.now() + STEP_SETTLE_MS;
    await settled();
    await until(settle);
    const startMs = Math.round(clock.now());
    open = { ...(comment === undefined ? {} : { comment }), startMs, actionEndMs: startMs };
  }

  async function end() {
    if (!open) return;
    await settled();
    await wait(STEP_SETTLE_MS);
    steps.push({ index: steps.length, ...open, endMs: Math.round(clock.now()) });
    open = undefined;
  }

  // Each queued comment opens a step; all but the last end with no action.
  async function layDown() {
    while (queued.length) {
      await end();
      await start(queued.shift());
    }
  }

  /** Throws when `word` is used inside a stretch, where nothing may add time or nest. */
  function outsideStretch(word: string) {
    if (stretch) throw new Error(`${word}() can't be used inside ${stretch}(); put it before or after`);
  }

  const comment: Stage["comment"] = (text) => {
    outsideStretch("comment");
    if (typeof text !== "string") throw new Error(`comment() takes text, got ${JSON.stringify(text)}`);
    queued.push(text);
  };

  const action: Stage["action"] = async (run) => {
    if (queued.length) await layDown();
    else if (!open) await start(undefined);
    // After the step before ended, so an overlay lasts through the hold that lets its comment finish.
    closeOverlays();
    const index = steps.length;
    const { comment: text } = open!;
    let result;
    try {
      result = await run();
    } catch (e) {
      if (stretch) throw e;
      const name = text === undefined ? "" : ` ("${text}")`;
      throw new Error(`step ${index}${name} failed: ${(e as Error).message}`, { cause: e });
    }
    open!.actionEndMs = Math.round(clock.now());
    return result;
  };

  // Runs `run` as one action, the stretch of `word`, and logs `event` in `events` before whatever `run` logged.
  async function stretchOf(word: string, run: () => Promise<unknown>, events: ComposerEvent[],
    event: (t: number, durationMs: number) => ComposerEvent): Promise<void> {
    await action(async () => {
      const at = events.length;
      const t = clock.now();
      stretch = word;
      try {
        await run();
      } finally {
        stretch = undefined;
      }
      events.splice(at, 0, event(t, clock.now() - t));
    });
  }

  /**
   * Runs `run` as one action whose stretch plays `factor` times faster, and logs it in `events` before whatever `run`
   * logged (GH-61 decisions 004 and 005).
   */
  async function speedUp(factor: number, run: () => Promise<unknown>, events: ComposerEvent[]): Promise<void> {
    outsideStretch("speedUp");
    speedFactor(factor);
    if (typeof run !== "function") throw new Error("speedUp() takes a function to run faster, as in speedUp(4, () => …)");
    await stretchOf("speedUp", run, events, (t, durationMs) => ({ t, type: "speed", factor, durationMs }));
  }

  /** Runs `run` as one action whose stretch is cut from the video, and logs it like `speedUp` (GH-62 decision 004). */
  async function skip(run: () => Promise<unknown>, options: unknown, events: ComposerEvent[]): Promise<void> {
    outsideStretch("skip");
    if (typeof run !== "function") throw new Error("skip() takes a function whose wait to cut, as in skip(() => …)");
    const { label, style } = skipSettings(options);
    await stretchOf("skip", run, events, (t, durationMs) => ({ t, type: "skip", durationMs, label, style }));
  }

  /** Throws when an effect word (`flash`, `zoomIn`, `zoomOut`) is used inside a skip, where nothing is seen. */
  function outsideSkip(word: string) {
    if (stretch === "skip") throw new Error(`${word}() can't be used inside skip(); put it before or after`);
  }

  /**
   * Shows an overlay as an action of its step: logs `event` now, waits its `ms`, and leaves it open until the script's
   * next action (GH-76 decision 007).
   */
  async function overlay(word: string, event: (t: number) => OverlayEvent, events: ComposerEvent[],
    bounds?: () => Promise<Bounds | undefined>): Promise<void> {
    outsideStretch(word);
    await action(async () => {
      const box = await bounds?.();
      const logged: OverlayEvent = { ...event(clock.now()), ...(box ? { bounds: box } : {}) };
      events.push(logged);
      overlays.push(logged);
      await wait(logged.ms);
    });
  }

  /** Lays down the comments still queued and ends the last step; call it after the script returns. */
  async function finish() {
    await layDown();
    await end();
    closeOverlays();
  }

  return { steps, comment, action, speedUp, skip, overlay, outsideStretch, outsideSkip, finish };
}

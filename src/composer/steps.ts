// Times a script's steps on the recording's clock (story decision 009 of GH-1, GH-30 decision 001). A comment opens a
// step; the step starts with the next action, after the app stops loading and settles, and ends when the following
// step is due, after the app stops loading and settles again. A comment with no action before the next comment is
// a step of its own, with no action.
import { setTimeout as sleep } from "node:timers/promises";
import type { Stage } from "./ports.ts";
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

  const comment: Stage["comment"] = (text) => {
    if (typeof text !== "string") throw new Error(`comment() takes text, got ${JSON.stringify(text)}`);
    queued.push(text);
  };

  const action: Stage["action"] = async (run) => {
    if (queued.length) await layDown();
    else if (!open) await start(undefined);
    const index = steps.length;
    const { comment: text } = open!;
    let result;
    try {
      result = await run();
    } catch (e) {
      const name = text === undefined ? "" : ` ("${text}")`;
      throw new Error(`step ${index}${name} failed: ${(e as Error).message}`, { cause: e });
    }
    open!.actionEndMs = Math.round(clock.now());
    return result;
  };

  /** Lays down the comments still queued and ends the last step; call it after the script returns. */
  async function finish() {
    await layDown();
    await end();
  }

  return { steps, comment, action, finish };
}

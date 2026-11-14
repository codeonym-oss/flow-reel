// Times a script's steps on the recording's clock: each step waits for the app to stop loading, settles, runs its
// action and settles again (story decision 009 of GH-1).
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
  const until = (ms: number) => wait(Math.max(0, ms - clock.now()));
  let inStep: string | undefined;
  const run: Stage["step"] = async (narration, action) => {
    const settle = clock.now() + STEP_SETTLE_MS;
    if (!(await idle())) warn(`step ${steps.length}: the page was still loading after 10 s; going on`);
    await until(settle);
    const startMs = Math.round(clock.now());
    try {
      await action();
    } catch (e) {
      throw new Error(`step ${steps.length} ("${narration}") failed: ${(e as Error).message}`, { cause: e });
    }
    const actionEndMs = Math.round(clock.now());
    if (!(await idle())) warn(`step ${steps.length}: the page was still loading after 10 s; going on`);
    await wait(STEP_SETTLE_MS);
    steps.push({ index: steps.length, narration, startMs, actionEndMs, endMs: Math.round(clock.now()) });
  };
  const step: Stage["step"] = async (narration, action) => {
    // Steps are sequential windows on one timeline: a nested or concurrent step would overlap another.
    if (inStep !== undefined) {
      throw new Error(`step("${narration}") started inside step("${inStep}"); await each step before the next`);
    }
    inStep = narration;
    try { await run(narration, action); } finally { inStep = undefined; }
  };
  return { steps, step };
}

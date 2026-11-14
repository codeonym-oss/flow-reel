import { expect, it } from "vitest";
import { stepTimer } from "../../src/composer/steps.ts";

// A clock that only moves when something sleeps, so timings are exact.
const fake = (idle: () => boolean = () => true) => {
  let now = 0;
  const warnings: string[] = [];
  const clock = { now: () => now };
  const sleep = async (ms: number) => { now += ms; };
  return { clock, sleep, warnings, advance: (ms: number) => { now += ms; },
    timer: stepTimer({ clock, sleep, idle: async () => idle(), warn: (message) => warnings.push(message) }) };
};

it("records each step's start, action end and end on the clock, in order", async () => {
  const { timer, advance } = fake();
  await timer.step("First.", async () => advance(40));
  await timer.step("Second.", async () => advance(10));
  expect(timer.steps).toEqual([
    { index: 0, narration: "First.", startMs: 100, actionEndMs: 140, endMs: 240 },
    { index: 1, narration: "Second.", startMs: 340, actionEndMs: 350, endMs: 450 },
  ]);
});

it("rejects a step started inside another, and allows the next one afterwards", async () => {
  const { timer } = fake();
  await expect(timer.step("Outer.", () => timer.step("Inner.", async () => {})))
    .rejects.toThrow('step 0 ("Outer.") failed: step("Inner.") started inside step("Outer."); await each step before the next');
  await timer.step("Next.", async () => {});
  expect(timer.steps.map((step) => step.narration)).toEqual(["Next."]);
});

it("names the failing step and keeps its cause", async () => {
  const { timer } = fake();
  const cause = new Error("no such button");
  const error = await timer.step("Save.", async () => { throw cause; }).catch((e: Error) => e);
  expect(error).toMatchObject({ message: 'step 0 ("Save.") failed: no such button', cause });
});

it("warns and goes on when the app is still loading", async () => {
  const { timer, warnings } = fake(() => false);
  await timer.step("Busy.", async () => {});
  expect(warnings).toEqual(Array(2).fill("step 0: the page was still loading after 10 s; going on"));
  expect(timer.steps).toHaveLength(1);
});

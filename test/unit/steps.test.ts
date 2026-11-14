import { expect, it } from "vitest";
import { stepTimer } from "../../src/composer/steps.ts";

// A clock that only moves when something sleeps, so timings are exact.
const fake = (idle: () => boolean = () => true) => {
  let now = 0;
  const warnings: string[] = [];
  const clock = { now: () => now };
  const sleep = async (ms: number) => { now += ms; };
  const advance = (ms: number) => async () => { now += ms; };
  return { clock, warnings, advance,
    timer: stepTimer({ clock, sleep, idle: async () => idle(), warn: (message) => warnings.push(message) }) };
};

it("opens a step at a comment's next action and ends it when the next step is due", async () => {
  const { timer, advance } = fake();
  timer.comment("First.");
  await timer.action(advance(40));
  timer.comment("Second.");
  await timer.action(advance(10));
  await timer.finish();
  expect(timer.steps).toEqual([
    { index: 0, comment: "First.", startMs: 100, actionEndMs: 140, endMs: 240 },
    { index: 1, comment: "Second.", startMs: 340, actionEndMs: 350, endMs: 450 },
  ]);
});

it("keeps every action until the next comment in one step", async () => {
  const { timer, advance } = fake();
  timer.comment("Fill the form.");
  await timer.action(advance(40));
  await timer.action(advance(30));
  await timer.finish();
  expect(timer.steps).toEqual([{ index: 0, comment: "Fill the form.", startMs: 100, actionEndMs: 170, endMs: 270 }]);
});

it("gives actions before the first comment a step without a comment", async () => {
  const { timer, advance } = fake();
  await timer.action(advance(20));
  timer.comment("Then this.");
  await timer.action(advance(20));
  await timer.finish();
  expect(timer.steps).toEqual([
    { index: 0, startMs: 100, actionEndMs: 120, endMs: 220 },
    { index: 1, comment: "Then this.", startMs: 320, actionEndMs: 340, endMs: 440 },
  ]);
});

it("holds a comment with no action as a step of its own", async () => {
  const { timer, advance } = fake();
  timer.comment("Look at this.");
  timer.comment("Now save.");
  await timer.action(advance(10));
  await timer.finish();
  expect(timer.steps).toEqual([
    { index: 0, comment: "Look at this.", startMs: 100, actionEndMs: 100, endMs: 200 },
    { index: 1, comment: "Now save.", startMs: 300, actionEndMs: 310, endMs: 410 },
  ]);
});

it("lays down a trailing comment when the script ends", async () => {
  const { timer, advance } = fake();
  timer.comment("Save.");
  await timer.action(advance(10));
  timer.comment("That's all.");
  await timer.finish();
  expect(timer.steps.map(({ comment, startMs, actionEndMs, endMs }) => ({ comment, startMs, actionEndMs, endMs }))).toEqual([
    { comment: "Save.", startMs: 100, actionEndMs: 110, endMs: 210 },
    { comment: "That's all.", startMs: 310, actionEndMs: 310, endMs: 410 },
  ]);
});

it("returns what the action returns", async () => {
  const { timer } = fake();
  expect(await timer.action(async () => 42)).toBe(42);
});

it("rejects a comment that isn't text", () => {
  const { timer } = fake();
  expect(() => timer.comment(42 as unknown as string)).toThrow("comment() takes text, got 42");
});

it("names the failing step and keeps its cause", async () => {
  const { timer } = fake();
  const cause = new Error("no such button");
  timer.comment("Save.");
  const error = await timer.action(async () => { throw cause; }).catch((e: Error) => e);
  expect(error).toMatchObject({ message: 'step 0 ("Save.") failed: no such button', cause });
  const plain = await fake().timer.action(async () => { throw cause; }).catch((e: Error) => e);
  expect(plain).toMatchObject({ message: "step 0 failed: no such button" });
});

it("warns and goes on when the app is still loading", async () => {
  const { timer, warnings } = fake(() => false);
  timer.comment("Busy.");
  await timer.action(async () => {});
  await timer.finish();
  expect(warnings).toEqual(Array(2).fill("step 0: the page was still loading after 10 s; going on"));
  expect(timer.steps).toHaveLength(1);
});

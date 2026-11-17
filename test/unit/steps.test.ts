import { describe, expect, it } from "vitest";
import type { ComposerEvent } from "../../src/composer/schema/events.ts";
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

describe("speedUp (GH-61 decisions 001, 004 and 005)", () => {
  it("runs its actions in the open step and logs the stretch where it started", async () => {
    const { timer, advance } = fake();
    const events: ComposerEvent[] = [];
    timer.comment("Wait for the reply.");
    await timer.speedUp(4, async () => {
      await timer.action(advance(20));
      events.push({ t: 120, type: "sound", name: "success" });
      await timer.action(advance(30));
    }, events);
    await timer.finish();
    expect(timer.steps).toEqual([{ index: 0, comment: "Wait for the reply.", startMs: 100, actionEndMs: 150, endMs: 250 }]);
    expect(events).toEqual([{ t: 100, type: "speed", factor: 4, durationMs: 50 }, { t: 120, type: "sound", name: "success" }]);
  });

  it("refuses a bad factor or a missing function where it is written", async () => {
    const { timer } = fake();
    for (const factor of [1, 0, 16.5, Number.NaN, "2"]) {
      await expect(timer.speedUp(factor as number, async () => {}, [])).rejects
        .toThrow(`speedUp(): the factor must be a number above 1 and at most 16, got ${JSON.stringify(factor)}`);
    }
    await expect(timer.speedUp(4, undefined as unknown as () => Promise<void>, [])).rejects
      .toThrow("speedUp() takes a function to run faster, as in speedUp(4, () => …)");
  });

  it("refuses comments, showFrame and nesting inside, and allows them again after", async () => {
    const { timer } = fake();
    const inside: unknown[] = [];
    await timer.speedUp(2, async () => {
      try { timer.comment("Hi."); } catch (e) { inside.push((e as Error).message); }
      try { timer.outsideStretch("showFrame"); } catch (e) { inside.push((e as Error).message); }
      await timer.speedUp(2, async () => {}, []).catch((e: Error) => inside.push(e.message));
    }, []);
    expect(inside).toEqual([
      "comment() can't be used inside speedUp(); put it before or after",
      "showFrame() can't be used inside speedUp(); put it before or after",
      "speedUp() can't be used inside speedUp(); put it before or after",
    ]);
    expect(() => timer.comment("After.")).not.toThrow();
  });

  it("names the failing step once when an action inside fails", async () => {
    const { timer } = fake();
    timer.comment("Wait.");
    const error = await timer.speedUp(4, async () => {
      await timer.action(async () => { throw new Error("timed out"); });
    }, []).catch((e: Error) => e);
    expect(error).toMatchObject({ message: 'step 0 ("Wait.") failed: timed out' });
    expect(() => timer.comment("Next.")).not.toThrow();
  });
});

describe("skip (GH-62 decisions 002 and 004)", () => {
  it("runs its actions in the open step and logs the cut where it started, with its label", async () => {
    const { timer, advance } = fake();
    const events: ComposerEvent[] = [];
    timer.comment("The build takes a while.");
    await timer.skip(async () => {
      await timer.action(advance(20));
      events.push({ t: 120, type: "sound", name: "success" });
    }, { label: "{duration} plus tard" }, events);
    await timer.skip(advance(5), { style: "bar" }, events);
    await timer.finish();
    expect(timer.steps).toEqual([{ index: 0, comment: "The build takes a while.", startMs: 100, actionEndMs: 125, endMs: 225 }]);
    expect(events).toEqual([{ t: 100, type: "skip", durationMs: 20, label: "{duration} plus tard", style: "clock" },
      { t: 120, type: "sound", name: "success" }, { t: 120, type: "skip", durationMs: 5, label: "{duration} skipped", style: "bar" }]);
  });

  it("refuses a missing function or bad options where it is written", async () => {
    const { timer } = fake();
    await expect(timer.skip(undefined as unknown as () => Promise<void>, undefined, [])).rejects
      .toThrow("skip() takes a function whose wait to cut, as in skip(() => …)");
    await expect(timer.skip(async () => {}, { label: "" }, [])).rejects.toThrow('skip(): label must be non-empty text, got ""');
  });

  it("refuses comments, effects and nesting inside, either way round, and allows them again after", async () => {
    const { timer } = fake();
    const inside: unknown[] = [];
    await timer.skip(async () => {
      try { timer.comment("Hi."); } catch (e) { inside.push((e as Error).message); }
      try { timer.outsideSkip("flash"); } catch (e) { inside.push((e as Error).message); }
      await timer.skip(async () => {}, undefined, []).catch((e: Error) => inside.push(e.message));
      await timer.speedUp(2, async () => {}, []).catch((e: Error) => inside.push(e.message));
    }, undefined, []);
    await timer.speedUp(2, async () => {
      try { timer.outsideSkip("zoomIn"); } catch (e) { inside.push((e as Error).message); }
      await timer.skip(async () => {}, undefined, []).catch((e: Error) => inside.push(e.message));
    }, []);
    expect(inside).toEqual([
      "comment() can't be used inside skip(); put it before or after",
      "flash() can't be used inside skip(); put it before or after",
      "skip() can't be used inside skip(); put it before or after",
      "speedUp() can't be used inside skip(); put it before or after",
      "skip() can't be used inside speedUp(); put it before or after",
    ]);
    expect(() => { timer.comment("After."); timer.outsideSkip("flash"); }).not.toThrow();
  });

  it("names the failing step once when an action inside fails", async () => {
    const { timer } = fake();
    timer.comment("Build.");
    const error = await timer.skip(async () => {
      await timer.action(async () => { throw new Error("timed out"); });
    }, undefined, []).catch((e: Error) => e);
    expect(error).toMatchObject({ message: 'step 0 ("Build.") failed: timed out' });
  });
});

import { describe, expect, it } from "vitest";
import { planTimeline } from "../../src/composer/timeline.ts";
import type { TranscriptStep } from "../../src/composer/schema/transcript.ts";

const step = (index: number, startMs: number, endMs: number, durationMs?: number): TranscriptStep => ({
  index, startMs, actionEndMs: endMs - 100, endMs, comment: durationMs ? "Hello" : " ",
  ...(durationMs ? { audio: { file: `${index}.wav`, durationMs, sha256: "a".repeat(64) } } : {}),
});

it("fits speech plus its tail by holding 21 frames and shifting the next action", () => {
  const source = [step(0, 500, 1000, 1000), step(1, 1200, 1500)];
  const plan = planTimeline(source, { fps: 30, frames: 90, cutMs: 1000 });
  expect(plan.insertions).toEqual([{ frame: 60, frames: 21 }]);
  expect(plan.steps.map(({ startMs, actionEndMs, endMs }) => [startMs, actionEndMs, endMs]))
    .toEqual([[500, 900, 1700], [1900, 2100, 2200]]);
  expect(plan.frames).toBe(111);
  expect(source[0].endMs).toBe(1000);
});

it("rounds fractional visual endpoints up and adds only whole frames", () => {
  const plan = planTimeline([step(0, 501, 999, 1000)], { fps: 30, frames: 75, cutMs: 1000 });
  expect(plan.insertions).toEqual([{ frame: 60, frames: 22 }]);
  expect(plan.steps[0].endMs).toBeCloseTo(1733.333333);
});

it("keeps long actions and blank steps without extra speech padding", () => {
  const plan = planTimeline([step(0, 0, 2000, 500), step(1, 2100, 2301)], { fps: 30, frames: 90, cutMs: 0 });
  expect(plan.insertions).toEqual([]);
  expect(plan.steps[1].endMs).toBeCloseTo(2333.333333);
});

it("maps gaps and boundary events once while retaining action durations", async () => {
  const { retimeEvents } = await import("../../src/composer/timeline.ts");
  const plan = planTimeline([step(0, 500, 1000, 1000), step(1, 1200, 1500, 900)],
    { fps: 30, frames: 90, cutMs: 1000 });
  expect(plan.insertions).toEqual([{ frame: 60, frames: 21 }, { frame: 75, frames: 24 }]);
  expect([999, 1000, 1100, 1499, 1500, 1900].map(plan.mapTime)).toEqual([999, 1700, 1800, 2199, 3000, 3400]);
  const events = [{ t: 1200, type: "scroll" as const, delta: [0, 300] as [number, number], durationMs: 400 },
    { t: 1500, type: "type" as const, text: "Ada", charDelayMs: 60, target: "Name",
      bounds: { x: -10, y: 20, width: 100, height: 30 } }];
  expect(retimeEvents(events, plan)).toEqual([{ ...events[0], t: 1900 }, { ...events[1], t: 3000 }]);
  expect(events[0].t).toBe(1200);
  expect(plan.frames).toBe(135);
});

it("supports no steps, zero-duration callbacks, and a hold at the final source frame", () => {
  expect(planTimeline([], { fps: 30, frames: 60, cutMs: 1000 }).frames).toBe(60);
  const source = { ...step(0, 500, 1000, 1000), actionEndMs: 500 };
  const plan = planTimeline([source], { fps: 30, frames: 60, cutMs: 1000 });
  expect(plan.steps[0]).toMatchObject({ startMs: 500, actionEndMs: 500, endMs: 1700 });
  expect(plan.frames).toBe(81);
});

it("rejects source windows beyond the capture instead of inventing missing frames", () => {
  expect(() => planTimeline([step(0, 500, 1100, 1000)], { fps: 30, frames: 60, cutMs: 1000 }))
    .toThrow(/capture/);
});

describe("images (GH-32 decision 003)", () => {
  const image = (t: number, durationMs: number, file = "a.png") => ({ t, durationMs, file, fit: "contain" as const, background: "#000000" });

  it("inserts an image inside a step and moves the rest of the step, later steps and events by its frames", async () => {
    const { retimeEvents } = await import("../../src/composer/timeline.ts");
    const plan = planTimeline([step(0, 500, 1500), step(1, 1700, 2000)],
      { fps: 30, frames: 120, cutMs: 1000, images: [image(800, 1000)] });
    expect(plan.insertions).toEqual([{ frame: 54, frames: 30, image: { file: "a.png", fit: "contain", background: "#000000" } }]);
    expect(plan.imageSpans).toEqual([{ startMs: 800, endMs: 1800 }]);
    expect(plan.steps.map(({ startMs, actionEndMs, endMs }) => [startMs, actionEndMs, endMs]))
      .toEqual([[500, 2400, 2500], [2700, 2900, 3000]]);
    expect(plan.frames).toBe(150);
    const events = [{ t: 800, type: "frame" as const, image: "a.png", sha256: "a".repeat(64), durationMs: 1000,
      fit: "contain" as const, background: "#000000" }, { t: 800, type: "flash" as const, color: "#ffffff", ms: 250 },
    { t: 799, type: "flash" as const, color: "#ffffff", ms: 250 }];
    expect(retimeEvents(events, plan).map((e) => e.t)).toEqual([800, 1800, 799]);
  });

  it("counts the image's frames when holding for a comment", () => {
    // 1 s step, 1.5 s comment: 0.7 s of hold without the image, none with a 1 s image inside the step.
    expect(planTimeline([step(0, 500, 1500, 1500)], { fps: 30, frames: 90, cutMs: 1000 }).insertions)
      .toEqual([{ frame: 75, frames: 21 }]);
    const plan = planTimeline([step(0, 500, 1500, 1500)], { fps: 30, frames: 90, cutMs: 1000, images: [image(600, 1000)] });
    expect(plan.insertions.map((i) => [i.frame, i.frames, Boolean(i.image)])).toEqual([[48, 30, true]]);
    expect(plan.steps[0].endMs).toBe(2500);
    // A 2.5 s comment needs 3.2 s; the step with its image lasts 2 s from 500 ms, so 0.7 s is held after the image
    // (without the image, 1.7 s would be).
    const longer = planTimeline([step(0, 500, 1500, 2500)], { fps: 30, frames: 90, cutMs: 1000, images: [image(600, 1000)] });
    expect(longer.insertions.map((i) => [i.frame, i.frames, Boolean(i.image)])).toEqual([[48, 30, true], [75, 21, false]]);
    expect(longer.steps[0].endMs).toBe(3200);
  });

  it("keeps two images at one moment in the order they were shown, after a hold at that frame", () => {
    const plan = planTimeline([step(0, 0, 1000, 1500)], { fps: 30, frames: 90, cutMs: 0,
      images: [image(1000, 100, "first.png"), image(1000, 100, "second.png")] });
    expect(plan.insertions.map((i) => i.image?.file ?? "hold")).toEqual(["hold", "first.png", "second.png"]);
    expect(plan.imageSpans).toEqual([{ startMs: 1700, endMs: 1800 }, { startMs: 1800, endMs: 1900 }]);
  });

  it("rejects an image beyond the capture", () => {
    expect(() => planTimeline([], { fps: 30, frames: 30, cutMs: 0, images: [image(2000, 100)] })).toThrow(/beyond the capture/);
  });
});

describe("speed-ups (GH-61 decisions 003, 007 and 008)", () => {
  const speedUp = (t: number, durationMs: number, factor: number) => ({ t, durationMs, factor });

  it("plays a ×4 stretch of 60 frames as 15 and moves everything after it earlier", () => {
    // Capture frame 0 is video 0 ms (cutMs 0); the stretch covers frames 30-89, 1000-3000 ms.
    const plan = planTimeline([step(0, 500, 4000), step(1, 4100, 4500)],
      { fps: 30, frames: 150, cutMs: 0, speedUps: [speedUp(1000, 2000, 4)] });
    expect(plan.stretches).toEqual([{ frame: 30, frames: 60, kept: 15, factor: 4, startMs: 1000, endMs: 1500 }]);
    expect(plan.frames).toBe(105);
    expect([500, 1000, 2000, 3000, 4100].map(plan.mapTime)).toEqual([500, 1000, 1250, 1500, 2600]);
    expect(plan.steps.map(({ startMs, actionEndMs, endMs }) => [startMs, actionEndMs, endMs]))
      .toEqual([[500, 2400, 2500], [2600, 2900, 3000]]);
  });

  it("keeps ceil(frames / factor) frames for a fractional factor", () => {
    const plan = planTimeline([], { fps: 30, frames: 30, cutMs: 0, speedUps: [speedUp(100, 1000 / 15, 1.5)] });
    expect(plan.stretches[0]).toMatchObject({ frames: 2, kept: 2 });
    const three = planTimeline([], { fps: 30, frames: 30, cutMs: 0, speedUps: [speedUp(100, 100, 1.5)] });
    expect(three.stretches[0]).toMatchObject({ frames: 3, kept: 2 });
    expect(three.frames).toBe(29);
  });

  it("still holds the last frame when a comment outlasts the shortened stretch", () => {
    // A 3 s comment over a step whose 2 s wait plays in 0.5 s: the step needs 3.2 s from 500 ms, but its picture
    // ends at 1.7 s, so 2 s are held.
    const plan = planTimeline([step(0, 500, 3200, 3000)],
      { fps: 30, frames: 120, cutMs: 0, speedUps: [speedUp(1000, 2000, 4)] });
    expect(plan.steps[0].endMs).toBe(3700);
    expect(plan.insertions).toEqual([{ frame: 96, frames: 60 }]);
    expect(plan.frames).toBe(120 - 45 + 60);
  });

  it("shortens an event's duration only by what the stretch drops inside it", async () => {
    const { retimeEvents } = await import("../../src/composer/timeline.ts");
    const plan = planTimeline([], { fps: 30, frames: 150, cutMs: 0, speedUps: [speedUp(1000, 2000, 4)] });
    const events = [
      { t: 500, type: "scroll" as const, delta: [0, 1] as [number, number], durationMs: 300 },
      { t: 1200, type: "zoom" as const, zoom: "out" as const, ms: 800 },
      { t: 2800, type: "flash" as const, color: "#ffffff", ms: 400 },
      { t: 1000, type: "type" as const, text: "Ada", charDelayMs: 100, target: "Name" },
      { t: 1000, type: "speed" as const, factor: 4, durationMs: 2000 },
    ];
    expect(retimeEvents(events, plan)).toEqual([
      { ...events[0], t: 500 },
      { ...events[1], t: 1050, ms: 200 },
      { ...events[2], t: 1450, ms: 50 + 200 },
      { ...events[3], t: 1000, charDelayMs: 25 },
      { ...events[4], t: 1000, durationMs: 500 },
    ]);
  });

  it("plays holds and images at its first frame before it, and changes nothing without one", () => {
    const image = { t: 1000, durationMs: 100, file: "a.png", fit: "contain" as const, background: "#000000" };
    const plan = planTimeline([], { fps: 30, frames: 150, cutMs: 0, images: [image], speedUps: [speedUp(1000, 2000, 4)] });
    expect(plan.stretches[0]).toMatchObject({ startMs: 1100, endMs: 1600 });
    const plain = planTimeline([step(0, 500, 1000, 1000)], { fps: 30, frames: 90, cutMs: 1000 });
    expect(plain.stretches).toEqual([]);
    expect(plain.frames).toBe(111);
  });
});

import { expect, it } from "vitest";
import { planTimeline } from "../../src/runner/timeline.ts";
import type { TranscriptStep } from "../../src/schema/transcript.ts";

const step = (index: number, startMs: number, endMs: number, durationMs?: number): TranscriptStep => ({
  index, startMs, actionEndMs: endMs - 100, endMs, narration: durationMs ? "Hello" : " ",
  ...(durationMs ? { audio: { file: `${index}.wav`, durationMs, sha256: "a".repeat(64) } } : {}),
});

it("fits speech plus its tail by holding 21 frames and shifting the next action", () => {
  const source = [step(0, 500, 1000, 1000), step(1, 1200, 1500)];
  const plan = planTimeline(source, { fps: 30, frames: 90, cutMs: 1000 });
  expect(plan.holds).toEqual([{ frame: 60, frames: 21 }]);
  expect(plan.steps.map(({ startMs, actionEndMs, endMs }) => [startMs, actionEndMs, endMs]))
    .toEqual([[500, 900, 1700], [1900, 2100, 2200]]);
  expect(plan.frames).toBe(111);
  expect(source[0].endMs).toBe(1000);
});

it("rounds fractional visual endpoints up and adds only whole frames", () => {
  const plan = planTimeline([step(0, 501, 999, 1000)], { fps: 30, frames: 75, cutMs: 1000 });
  expect(plan.holds).toEqual([{ frame: 60, frames: 22 }]);
  expect(plan.steps[0].endMs).toBeCloseTo(1733.333333);
});

it("keeps long actions and blank steps without extra speech padding", () => {
  const plan = planTimeline([step(0, 0, 2000, 500), step(1, 2100, 2301)], { fps: 30, frames: 90, cutMs: 0 });
  expect(plan.holds).toEqual([]);
  expect(plan.steps[1].endMs).toBeCloseTo(2333.333333);
});

it("maps gaps and boundary events once while retaining action durations", async () => {
  const { retimeEvents } = await import("../../src/runner/timeline.ts");
  const plan = planTimeline([step(0, 500, 1000, 1000), step(1, 1200, 1500, 900)],
    { fps: 30, frames: 90, cutMs: 1000 });
  expect(plan.holds).toEqual([{ frame: 60, frames: 21 }, { frame: 75, frames: 24 }]);
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

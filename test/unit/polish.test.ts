import { expect, it } from "vitest";
import { planPolish } from "../../src/runner/polish.ts";
import type { RunnerEvent } from "../../src/schema/events.ts";

const options = { viewport: [1920, 1080] as [number, number], source: [2560, 1440] as [number, number], fps: 30, frames: 180 };
const click = (t: number, at: [number, number] = [960, 540]): Extract<RunnerEvent, { type: "click" }> =>
  ({ t, type: "click", at, button: "left", target: "button" });

it("keeps camera lookahead and ripples unchanged when sound cues are interleaved", () => {
  const move: RunnerEvent = { t: 1200, type: "move", from: [960, 540], to: [1700, 900], durationMs: 450, easing: "easeInOutCubic" };
  const events: RunnerEvent[] = [click(1000), move, { ...click(1650, [1700, 900]), bounds: { x: 0, y: 0, width: 1900, height: 1000 } }];
  const base = planPolish(events, options);
  const cues = planPolish([events[0], move, { t: 1400, type: "sfx", name: "open" }, events[2]], options);
  for (let n = 0; n < options.frames; n++) expect(cues.frame(n)).toEqual(base.frame(n));
});

it("zooms on click, holds for two seconds, then eases back without extending the video", () => {
  const plan = planPolish([click(1000)], { ...options, fps: 40, frames: 240 });
  expect(plan.frame(39).crop).toEqual([0, 0, 1]);
  expect(plan.frame(40).zoom).toBe(1);
  expect(plan.frame(66).crop).toEqual([0.125, 0.125, 0.75]);
  expect(plan.frame(120).zoom).toBeCloseTo(4 / 3);
  expect(plan.frame(136).zoom).toBeCloseTo(1 / 0.875);
  expect(plan.frame(152).crop).toEqual([0, 0, 1]);
  expect(plan.frames).toBe(240);
});

it("merges clicks and typing, including activity during ease-out, without snapping", () => {
  const events: RunnerEvent[] = [click(1000),
    { t: 1500, type: "type", text: "hello", charDelayMs: 60, target: "field" }, click(4000)];
  const plan = planPolish(events, options);
  expect(plan.frame(113).zoom).toBeCloseTo(4 / 3);
  expect(plan.frame(120).zoom).toBeGreaterThan(1);
  expect(Math.abs(plan.frame(120).zoom - plan.frame(119).zoom)).toBeLessThan(0.02);
  expect(plan.frame(140).zoom).toBeCloseTo(4 / 3);
  expect(plan.frame(204).zoom).toBe(1);
});

it("extends the hold without restarting an unfinished zoom when typing begins", () => {
  const base = planPolish([click(1000)], options);
  const typing = planPolish([click(1000), { t: 1300, type: "type", text: "hello", charDelayMs: 60, target: "field" }], options);
  for (let n = 39; n <= 50; n++) expect(typing.frame(n).zoom).toBeCloseTo(base.frame(n).zoom, 10);
  expect(typing.frame(105).zoom).toBeCloseTo(4 / 3);
});

it("follows logged eased pointer paths, holds between moves, and times fractional clicks by frame", () => {
  const events: RunnerEvent[] = [{ t: 0, type: "move", from: [0, 0], to: [1920, 1080], durationMs: 1000, easing: "easeInOutCubic" },
    click(1000.1, [1920, 1080])];
  const plan = planPolish(events, options);
  expect(plan.frame(0).cursor).toEqual([0, 0]);
  expect(plan.frame(15).cursor).toEqual([960, 540]);
  expect(plan.frame(30).cursor).toEqual([1920, 1080]);
  expect(plan.frame(30).ripples).toEqual([]);
  expect(plan.frame(31).ripples).toHaveLength(1);
  expect(plan.frame(43).ripples).toEqual([]);
  expect(plan.frame(50).crop[0]).toBeGreaterThan(0.24);
  expect(() => planPolish([{ ...events[0], easing: "unknown" } as RunnerEvent], options)).toThrow(/easing/);
});

it("fits padded targets at edges and reduces zoom for large or partly off-screen targets", () => {
  for (const bounds of [{ x: 0, y: 0, width: 100, height: 40 },
    { x: 1400, y: 900, width: 520, height: 180 }, { x: -30, y: -10, width: 1900, height: 1000 }]) {
    const event = { ...click(1000, [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]), bounds };
    const p = planPolish([event], options);
    for (let frame = 0; frame < options.frames; frame++) {
      const { crop: [x, y, share], zoom } = p.frame(frame);
      expect(x).toBeGreaterThanOrEqual(-1e-9); expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(x + share).toBeLessThanOrEqual(1 + 1e-9); expect(y + share).toBeLessThanOrEqual(1 + 1e-9);
      expect(zoom).toBeLessThanOrEqual(4 / 3 + 1e-9);
      expect(x * 1920).toBeLessThanOrEqual(Math.max(0, bounds.x) + 1e-6);
      expect((x + share) * 1920).toBeGreaterThanOrEqual(Math.min(1920, bounds.x + bounds.width) - 1e-6);
      expect(y * 1080).toBeLessThanOrEqual(Math.max(0, bounds.y) + 1e-6);
      expect((y + share) * 1080).toBeGreaterThanOrEqual(Math.min(1080, bounds.y + bounds.height) - 1e-6);
    }
  }
  const big = planPolish([{ ...click(0), bounds: { x: 0, y: 0, width: 1920, height: 1080 } }], options);
  expect(big.frame(40).zoom).toBe(1);
  const custom = planPolish([click(0)], { ...options, source: [2000, 1125] });
  expect(custom.frame(30).zoom).toBeCloseTo(2000 / 1920);
});

it("does not zoom for hover, scrolling or standalone typing and preserves inputs", () => {
  const events: RunnerEvent[] = [
    { t: 0, type: "move", from: [960, 540], to: [100, 100], durationMs: 300, easing: "easeInOutCubic" },
    { t: 400, type: "scroll", delta: [0, 600], durationMs: 400 },
    { t: 800, type: "type", text: "old log", charDelayMs: 60, target: "field" }];
  const before = JSON.stringify(events);
  const p = planPolish(events, options);
  expect(p.frame(90).crop).toEqual([0, 0, 1]);
  expect(p.frame(90).cursor[0]).toBeCloseTo(100);
  expect(p.frame(90).cursor[1]).toBeCloseTo(100);
  expect(p.frame(90).ripples).toEqual([]);
  expect(planPolish([], options).frame(0).cursor).toEqual([960, 540]);
  expect(JSON.stringify(events)).toBe(before);
});

it("does not restart zoom or jump when a hover begins during ease-out", () => {
  const plan = planPolish([click(0), { t: 2400, type: "move", from: [960, 540], to: [1700, 900],
    durationMs: 600, easing: "easeInOutCubic" }], options);
  expect(plan.frame(72).zoom).toBeCloseTo(1 / 0.875);
  expect(plan.frame(76).zoom).toBeLessThan(plan.frame(72).zoom);
  expect(plan.frame(84).zoom).toBe(1);
});

it("keeps a fast pointer visible across the viewport during ease-out without extending zoom", () => {
  const p = planPolish([click(0, [50, 540]), { t: 2010, type: "move", from: [50, 540], to: [1900, 540],
    durationMs: 300, easing: "easeInOutCubic" }], options);
  for (let n = 60; n < 85; n++) {
    expect(p.frame(n).cursor[0]).toBeGreaterThanOrEqual(0);
    expect(p.frame(n).cursor[0]).toBeLessThanOrEqual(1920);
  }
  expect(p.frame(68).cursor[0]).toBeLessThanOrEqual(1896 + 1e-6);
  expect(p.frame(84).zoom).toBe(1);
});

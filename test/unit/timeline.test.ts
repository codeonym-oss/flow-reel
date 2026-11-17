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

describe("skips (GH-62 decisions 003 and 004)", () => {
  const skip = (t: number, durationMs: number) => ({ t, durationMs });

  it("cuts a 60 s wait to a 1.5 s card holding the frame before it, and moves everything after it earlier", () => {
    // Capture frame 0 is video 0 ms (cutMs 0); the skip covers frames 30-1829, 1000-61000 ms.
    const plan = planTimeline([], { fps: 30, frames: 2000, cutMs: 0, skips: [skip(1000, 60_000)] });
    expect(plan.skips).toEqual([{ frame: 30, frames: 1800 }]);
    expect(plan.insertions).toEqual([{ frame: 30, frames: 45, card: { id: "skip0" } }]);
    expect(plan.cards).toEqual([{ id: "skip0", frame: 30, frames: 45, startMs: 1000, endMs: 2500 }]);
    expect(plan.stretches).toEqual([]);
    expect(plan.frames).toBe(2000 + 45 - 1800);
    expect([500, 62_000].map(plan.mapTime)).toEqual([500, 3500]);
  });

  it("lasts until the comment spoken over it ends, in place of the step's hold", () => {
    // A 5 s comment from 500 ms needs the video until 5.7 s; the card starts at 1.5 s, so it lasts 4.2 s, and the step
    // ends after the 200 ms left of it, with nothing held.
    const plan = planTimeline([step(0, 500, 61_700, 5000)], { fps: 30, frames: 2000, cutMs: 0, skips: [skip(1500, 60_000)] });
    expect(plan.insertions).toEqual([{ frame: 45, frames: 126, card: { id: "skip0" } }]);
    expect(plan.cards).toEqual([{ id: "skip0", frame: 45, frames: 126, startMs: 1500, endMs: 5700 }]);
    expect(plan.steps.map(({ startMs, actionEndMs, endMs }) => [startMs, actionEndMs, endMs])).toEqual([[500, 5800, 5900]]);
  });

  it("drops what was logged inside a skip, and moves the skip to its card keeping the length cut", async () => {
    const { dropSkipped, retimeEvents } = await import("../../src/composer/timeline.ts");
    const events = [
      { t: 999, type: "sound" as const, name: "open" as const },
      { t: 1000, type: "skip" as const, durationMs: 60_000, label: "{duration} skipped", style: "clock" as const },
      { t: 1000, type: "click" as const, at: [1, 1] as [number, number], button: "left" as const, target: "Build" },
      { t: 60_999, type: "sound" as const, name: "success" as const },
      { t: 62_000, type: "flash" as const, color: "#ffffff", ms: 250 },
    ];
    const seen = dropSkipped(events);
    expect(seen).toEqual([events[0], events[1], events[4]]);
    const plan = planTimeline([], { fps: 30, frames: 2000, cutMs: 0, skips: [skip(1000, 60_000)] });
    expect(retimeEvents(seen, plan).map((e) => [e.type, e.t])).toEqual([["sound", 999], ["skip", 1000], ["flash", 3500]]);
    expect(retimeEvents(seen, plan)[1]).toMatchObject({ durationMs: 60_000 });
  });

  it("plays a later speed-up after the card", () => {
    const plan = planTimeline([], { fps: 30, frames: 2000, cutMs: 0,
      skips: [skip(1000, 10_000)], speedUps: [{ t: 12_000, durationMs: 2000, factor: 4 }] });
    // 11 s of capture before the stretch, less 10 s cut, plus the 1.5 s card.
    expect(plan.stretches[0]).toMatchObject({ frame: 360, kept: 15, startMs: 3500, endMs: 4000 });
    expect(plan.frames).toBe(2000 - 300 + 45 - 45);
  });
});

describe("cards (GH-76 decision 002)", () => {
  it("inserts a card for 3 s at its frame, and moves everything after it later", () => {
    const plan = planTimeline([], { fps: 30, frames: 600, cutMs: 0, cards: [{ t: 1000 }] });
    expect(plan.insertions).toEqual([{ frame: 30, frames: 90, card: { id: "card0" } }]);
    expect(plan.cards).toEqual([{ id: "card0", frame: 30, frames: 90, startMs: 1000, endMs: 4000 }]);
    expect(plan.frames).toBe(690);
    expect([500, 2000].map(plan.mapTime)).toEqual([500, 5000]);
  });

  it("lasts until its step's comment ends, or exactly its ms", () => {
    // A 6 s comment from 500 ms needs the video until 6.7 s; the card starts at 1 s, so it lasts 5.7 s.
    const long = planTimeline([step(0, 500, 1200, 6000)], { fps: 30, frames: 600, cutMs: 0, cards: [{ t: 1000 }] });
    expect(long.cards[0]).toMatchObject({ frames: 171, startMs: 1000, endMs: 6700 });
    expect(long.steps[0].endMs).toBe(6900);
    const exact = planTimeline([step(0, 500, 1200, 6000)], { fps: 30, frames: 600, cutMs: 0, cards: [{ t: 1000, ms: 2000 }] });
    expect(exact.cards[0]).toMatchObject({ frames: 60, startMs: 1000, endMs: 3000 });
    // The rest of the comment holds the app's frame after the card, as for an image.
    expect(exact.steps[0].endMs).toBe(6700);
  });

  it("orders card words and skips by when they were shown, and retimes card events to their card", async () => {
    const { retimeEvents } = await import("../../src/composer/timeline.ts");
    const plan = planTimeline([], { fps: 30, frames: 2000, cutMs: 0, skips: [{ t: 2000, durationMs: 10_000 }], cards: [{ t: 1000 }, { t: 13_000, ms: 1000 }] });
    expect(plan.cards.map(({ id, startMs, endMs }) => [id, startMs, endMs])).toEqual([["card0", 1000, 4000], ["skip0", 5000, 6500], ["card1", 7500, 8500]]);
    const card = { type: "card" as const, card: "intro" as const, props: { title: "x" }, files: [], enter: "fade" as const, exit: "fade" as const, theme: "ink" as const };
    expect(retimeEvents([{ t: 1000, ...card }, { t: 13_000, ...card }], plan).map((e) => e.t)).toEqual([1000, 7500]);
  });
});

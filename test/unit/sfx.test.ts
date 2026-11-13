import { expect, it } from "vitest";
import { cueLogger, planSfx } from "../../src/runner/sfx.ts";
import { SFX_NAMES, validateEvents, type RunnerEvent } from "../../src/schema/events.ts";
import { planTimeline, retimeEvents } from "../../src/runner/timeline.ts";

it("logs named cues immediately on the runner clock and rejects unknown names", () => {
  const events: RunnerEvent[] = [];
  const clock = { now: () => 123.5 };
  const sfx = cueLogger(clock, events);
  expect(sfx("success")).toBeUndefined();
  expect(events).toEqual([{ t: 123.5, type: "sfx", name: "success" }]);
  expect(validateEvents({ version: 2, events })).toEqual([]);
  expect(validateEvents({ version: 1, events })).not.toEqual([]);
  // @ts-expect-error unknown cue names must also fail in untyped scripts
  expect(() => sfx("kaboom")).toThrow(/unknown sound cue/);
  expect(events).toHaveLength(1);
  expect(validateEvents({ version: 2, events: [{ t: 0, type: "sfx", name: "kaboom" }] })).not.toEqual([]);
});

it("replaces only nearby click audio at inclusive 150 ms boundaries and keeps every explicit cue", () => {
  const click = (t: number): RunnerEvent => ({ t, type: "click", at: [0, 0], button: "left", target: "button" });
  const events: RunnerEvent[] = [click(849.9), click(850), click(1150), click(1150.1),
    ...SFX_NAMES.map((name): RunnerEvent => ({ t: 1000, type: "sfx", name }))];
  const placed = planSfx(events, 2000);
  expect(placed.filter((p) => p.asset === "click").map((p) => p.sample)).toEqual([40795, 55205]);
  expect(placed.filter((p) => p.asset !== "click").map((p) => p.asset)).toEqual(SFX_NAMES);
});

it("retimes cues through a hold exactly once and drops audio starting at the delivery end", () => {
  const timeline = planTimeline([{ index: 0, startMs: 0, actionEndMs: 100, endMs: 300,
    audio: { file: "one.wav", durationMs: 700, sha256: "a".repeat(64) } }], { fps: 30, frames: 60, cutMs: 0 });
  const events: RunnerEvent[] = [{ t: 300, type: "sfx", name: "success" }];
  expect(planSfx(retimeEvents(events, timeline), 2600)).toEqual([{ sample: 43200, asset: "success" }]);
  expect(planSfx([{ t: 1000, type: "sfx", name: "error" }], 1000)).toEqual([]);
  expect(planSfx([{ t: 100, type: "type", text: "abc", charDelayMs: 0, target: "field" }], 1000))
    .toEqual([{ sample: 4800, asset: "typing0" }, { sample: 4800, asset: "typing1" }, { sample: 4800, asset: "typing2" }]);
  expect(planSfx([], 1000)).toEqual([]);
});

it("places fractional clicks and Unicode typing with deterministic tap variation", () => {
  const events: RunnerEvent[] = [
    { t: 300, type: "type", text: "", charDelayMs: 60, target: "field" },
    { t: 100, type: "type", text: "A😀e\u0301 ", charDelayMs: 60, target: "field" },
    { t: 0.125, type: "click", at: [0, 0], button: "left", target: "button" },
  ];
  const original = structuredClone(events);
  expect(planSfx(events, 1000)).toEqual([
    { sample: 6, asset: "click" },
    { sample: 4800, asset: "typing0" },
    { sample: 10560, asset: "typing1" },
    { sample: 10560, asset: "typing2" },
    { sample: 16320, asset: "typing0" },
    { sample: 16320, asset: "typing1" },
  ]);
  expect(events).toEqual(original);
});

it("plays one click sound for a double-click's two presses, but separate sounds for separate clicks", () => {
  const click = (t: number): RunnerEvent => ({ t, type: "click", at: [0, 0], button: "left", target: "button" });
  const clicks = planSfx([click(1000), click(1000.2), click(1500)], 2000).filter((p) => p.asset === "click");
  expect(clicks.map((p) => p.sample)).toEqual([48000, 72000]);
});

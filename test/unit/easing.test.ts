import { describe, expect, it } from "vitest";
import { easeInOutCubic, moveDuration, pathPoints } from "../../src/runner/easing.ts";

describe("easeInOutCubic", () => {
  it("starts at 0, is halfway at the midpoint, ends at 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("is slow at the ends: a quarter of the time covers 1/16 of the way", () => {
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625);
  });
});

describe("moveDuration", () => {
  it("takes 300 ms for no distance and 700 ms across the whole 1920×1080 viewport", () => {
    expect(moveDuration([10, 10], [10, 10])).toBe(300);
    expect(moveDuration([0, 0], [1920, 1080])).toBe(700);
  });

  it("never exceeds 700 ms, even beyond the viewport", () => {
    expect(moveDuration([0, 0], [5000, 5000])).toBe(700);
  });
});

describe("pathPoints", () => {
  it("gives one point per frame, ending exactly on the target", () => {
    const points = pathPoints([0, 0], [300, 150], 500, 30);
    expect(points).toHaveLength(15);
    expect(points.at(-1)).toEqual([300, 150]);
  });

  it("only moves forward", () => {
    const xs = pathPoints([0, 0], [300, 0], 500, 30).map(([x]) => x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});

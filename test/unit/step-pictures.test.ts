import { expect, it } from "vitest";
import { stepFrames } from "../../src/composer/media/step-pictures.ts";
import { stepPictureFile } from "../../src/composer/schema/files.ts";

const step = (startMs: number, actionEndMs: number, endMs: number) => ({ index: 0, startMs, actionEndMs, endMs });

it("takes each step at the end of its action, at least 0.5 s in, on the capture's frames (GH-139 decision 003)", () => {
  // The video starts 1 s into the capture, at 30 frames a second.
  expect(stepFrames([step(0, 2000, 3000), step(3000, 3100, 5000), step(5000, 5000, 5200)], 1000, 30, 1000))
    .toEqual([90, 135, 186]);
});

it("never takes a frame the capture doesn't have", () => {
  expect(stepFrames([step(0, 9000, 9000)], 1000, 30, 200)).toEqual([199]);
});

it("names pictures by step", () => {
  expect(stepPictureFile(7)).toBe("007.jpg");
});

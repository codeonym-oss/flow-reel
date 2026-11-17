import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { flashSettings, zoomInSettings, zoomOutSettings } from "../../src/composer/effects.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-effects-"));
  dirs.push(dir);
  mkdirSync(join(dir, "img"));
  writeFileSync(join(dir, "img", "diagram.PNG"), "png");
  return dir;
};

it("applies the defaults of GH-32 decision 002", () => {
  expect(flashSettings()).toEqual({ color: "#ffffff", ms: 250 });
  expect(zoomInSettings()).toEqual({ scale: 4 / 3, ms: 650 });
  expect(zoomOutSettings()).toEqual({ ms: 800 });
  expect(flashSettings({ color: "#FF0000", ms: 100 })).toEqual({ color: "#ff0000", ms: 100 });
  expect(zoomInSettings({ scale: 2 })).toEqual({ scale: 2, ms: 650 });
});

it("names each bad option at the call", () => {
  expect(() => flashSettings({ color: "red" })).toThrow('flash(): color must be a #rrggbb colour, got "red"');
  expect(() => flashSettings({ ms: 0 })).toThrow("flash(): ms must be a number of milliseconds > 0, got 0");
  expect(() => flashSettings({ colour: "#ffffff" })).toThrow('flash(): unknown option "colour"; it takes color, ms');
  expect(() => flashSettings("#ffffff")).toThrow("flash() takes an options object");
  expect(() => zoomInSettings({ scale: 3 })).toThrow("zoomIn(): scale must be a number from 1 to 2, got 3");
  expect(() => zoomInSettings({ scale: 0.5 })).toThrow("scale must be a number from 1 to 2");
  expect(() => zoomOutSettings({ ms: -1 })).toThrow("zoomOut(): ms must be a number of milliseconds > 0");
});

describe("skip (GH-62 decision 002, GH-76 decision 008)", () => {
  it("defaults the label and style, and refuses unknown options, empty or non-text labels and unknown styles", async () => {
    const { skipSettings } = await import("../../src/composer/effects.ts");
    expect(skipSettings()).toEqual({ label: "{duration} skipped", style: "clock" });
    expect(skipSettings({ label: "{duration} plus tard", style: "bar" })).toEqual({ label: "{duration} plus tard", style: "bar" });
    expect(() => skipSettings({ style: "ring" })).toThrow('skip(): style must be "clock" or "bar", got "ring"');
    expect(() => skipSettings({ lable: "x" })).toThrow('skip(): unknown option "lable"; it takes label, style');
    for (const label of ["", " ", 4]) {
      expect(() => skipSettings({ label })).toThrow(`skip(): label must be non-empty text, got ${JSON.stringify(label)}`);
    }
    expect(() => skipSettings("x")).toThrow("skip() takes an options object");
  });

  it("shows lengths in whole seconds and minutes", async () => {
    const { formatDuration } = await import("../../src/composer/effects.ts");
    expect([400, 38_400, 59_600, 112_400, 120_000, 3_600_000].map(formatDuration))
      .toEqual(["0 s", "38 s", "1 min", "1 min 52 s", "2 min", "60 min"]);
  });
});

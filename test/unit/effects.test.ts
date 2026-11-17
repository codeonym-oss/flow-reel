import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { flashSettings, frameRequest, zoomInSettings, zoomOutSettings } from "../../src/composer/effects.ts";

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

it("checks a showFrame image and records its relative path and hash", () => {
  const dir = folder();
  expect(frameRequest(dir, "img/diagram.PNG", 3000)).toEqual({
    file: join(dir, "img", "diagram.PNG"),
    event: { type: "frame", image: "img/diagram.PNG", sha256: createHash("sha256").update("png").digest("hex"),
      durationMs: 3000, fit: "contain", background: "#000000" },
  });
  expect(frameRequest(dir, "./img/../img/diagram.PNG", 10, { fit: "cover", background: "#123ABC" }).event)
    .toMatchObject({ image: "img/diagram.PNG", fit: "cover", background: "#123abc" });
});

it("rejects images the composer can't read or render", () => {
  const dir = folder();
  writeFileSync(join(dir, "notes.txt"), "");
  expect(() => frameRequest(dir, "/etc/hosts.png", 10)).toThrow("must be relative to the script's folder, not absolute");
  expect(() => frameRequest(dir, "../outside.png", 10)).toThrow("../outside.png is outside the script's folder");
  expect(() => frameRequest(dir, "notes.txt", 10)).toThrow("notes.txt must be a PNG, JPEG or WebP image");
  expect(() => frameRequest(dir, "missing.png", 10)).toThrow("showFrame(): missing.png doesn't exist");
  expect(() => frameRequest(dir, "img/diagram.PNG", undefined)).toThrow("showFrame() takes how long to show the image");
  expect(() => frameRequest(dir, "img/diagram.PNG", 0)).toThrow("the duration must be a number of milliseconds > 0");
  expect(() => frameRequest(dir, "img/diagram.PNG", 10, { fit: "stretch" })).toThrow('fit must be "contain" or "cover"');
  expect(() => frameRequest(dir, 42, 10)).toThrow("showFrame() takes the image's path");
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

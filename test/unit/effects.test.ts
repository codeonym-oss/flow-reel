import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
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

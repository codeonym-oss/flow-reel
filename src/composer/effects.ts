// The effect words' options, their defaults and their checks (GH-32 decisions 001, 002 and 004). A bad value throws
// where the script calls the word, as an unknown sound does, since a script in plain JavaScript has no types.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { type Bounds, type FlashEvent, type FrameEvent, type Point, type ZoomEvent, FITS, type Fit, HEX_COLOR, MAX_ZOOM } from "./schema/events.ts";

export interface FlashOptions {
  /** `#rrggbb`; white by default. */
  color?: string;
  /** How long the flash takes to fade, in milliseconds; 250 by default. */
  ms?: number;
}
export interface ShowFrameOptions {
  /** `contain` shows the whole image on `background`; `cover` fills the screen and crops. */
  fit?: Fit;
  /** `#rrggbb` behind a contained image; black by default. */
  background?: string;
}
export interface ZoomInOptions {
  /** The most the picture is enlarged, from 1 to 2; 4/3 by default, the sharpest the capture allows. */
  scale?: number;
  /** How long the zoom takes, in milliseconds; 650 by default. */
  ms?: number;
}
export interface ZoomOutOptions {
  /** How long the return to the full screen takes, in milliseconds; 800 by default. */
  ms?: number;
}

export const ZOOM_IN_MS = 650;
export const ZOOM_OUT_MS = 800;
export const DEFAULT_SCALE = 4 / 3;
const IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".webp"];

function options<T extends object>(word: string, value: unknown, keys: (keyof T & string)[]): Partial<T> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${word}() takes an options object`);
  const unknown = Object.keys(value).filter((key) => !keys.includes(key as keyof T & string));
  if (unknown.length) throw new Error(`${word}(): unknown option ${JSON.stringify(unknown[0])}; it takes ${keys.join(", ")}`);
  return value as Partial<T>;
}

function positive(word: string, key: string, value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${word}(): ${key} must be a number of milliseconds > 0, got ${JSON.stringify(value)}`);
  }
  return value;
}

function color(word: string, key: string, value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !HEX_COLOR.test(value)) throw new Error(`${word}(): ${key} must be a #rrggbb colour, got ${JSON.stringify(value)}`);
  return value.toLowerCase();
}

export function flashSettings(value?: unknown): Pick<FlashEvent, "color" | "ms"> {
  const o = options<FlashOptions>("flash", value, ["color", "ms"]);
  return { color: color("flash", "color", o.color, "#ffffff"), ms: positive("flash", "ms", o.ms, 250) };
}

export function zoomInSettings(value?: unknown): { scale: number; ms: number } {
  const o = options<ZoomInOptions>("zoomIn", value, ["scale", "ms"]);
  const scale = o.scale ?? DEFAULT_SCALE;
  if (typeof scale !== "number" || !(scale >= 1 && scale <= MAX_ZOOM)) {
    throw new Error(`zoomIn(): scale must be a number from 1 to ${MAX_ZOOM}, got ${JSON.stringify(o.scale)}`);
  }
  return { scale, ms: positive("zoomIn", "ms", o.ms, ZOOM_IN_MS) };
}

export function zoomOutSettings(value?: unknown): { ms: number } {
  const o = options<ZoomOutOptions>("zoomOut", value, ["ms"]);
  return { ms: positive("zoomOut", "ms", o.ms, ZOOM_OUT_MS) };
}

export const zoomInEvent = (t: number, at: Point, bounds: Bounds | undefined, settings: { scale: number; ms: number }): ZoomEvent =>
  ({ t, type: "zoom", zoom: "in", at, ...(bounds ? { bounds } : {}), ...settings });
export const zoomOutEvent = (t: number, settings: { ms: number }): ZoomEvent => ({ t, type: "zoom", zoom: "out", ...settings });

/** A checked `showFrame` call: the event without its time, and the image's absolute path for the renderer. */
export interface FrameRequest { event: Omit<FrameEvent, "t">; file: string }

/** Checks a `showFrame` call; the image must be a PNG, JPEG or WebP inside the script's folder (the one mounted). */
export function frameRequest(scriptDir: string, image: unknown, durationMs: unknown, value?: unknown): FrameRequest {
  const o = options<ShowFrameOptions>("showFrame", value, ["fit", "background"]);
  if (typeof image !== "string" || !image) throw new Error("showFrame() takes the image's path, relative to the script");
  if (isAbsolute(image)) throw new Error(`showFrame(): ${image} must be relative to the script's folder, not absolute`);
  const file = resolve(scriptDir, image);
  const inside = relative(scriptDir, file);
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) {
    throw new Error(`showFrame(): ${image} is outside the script's folder; only that folder is available to the composer`);
  }
  if (!IMAGE_TYPES.includes(extname(file).toLowerCase())) throw new Error(`showFrame(): ${image} must be a PNG, JPEG or WebP image`);
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`showFrame(): ${image} doesn't exist`);
  const ms = positive("showFrame", "the duration", durationMs, NaN);
  if (Number.isNaN(ms)) throw new Error("showFrame() takes how long to show the image, in milliseconds");
  const fit = o.fit ?? "contain";
  if (!FITS.includes(fit)) throw new Error(`showFrame(): fit must be "contain" or "cover", got ${JSON.stringify(o.fit)}`);
  return {
    file,
    event: {
      type: "frame", image: inside.split(sep).join("/"),
      sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
      durationMs: ms, fit, background: color("showFrame", "background", o.background, "#000000"),
    },
  };
}

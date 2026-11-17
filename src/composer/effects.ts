// The effect words' options, their defaults and their checks (GH-32 decisions 001, 002 and 004). A bad value throws
// where the script calls the word, as an unknown sound does, since a script in plain JavaScript has no types.
import { type Bounds, type FlashEvent, type Point, type ZoomEvent, HEX_COLOR, MAX_SPEED, MAX_ZOOM, SKIP_STYLES, type SkipStyle } from "./schema/events.ts";

export interface FlashOptions {
  /** `#rrggbb`; white by default. */
  color?: string;
  /** How long the flash takes to fade, in milliseconds; 250 by default. */
  ms?: number;
}
export interface ZoomInOptions {
  /** The most the picture is enlarged, from 1 to 2; 4/3 by default, the sharpest the capture allows. */
  scale?: number;
  /** How long the zoom takes, in milliseconds; 650 by default. */
  ms?: number;
}
export interface SkipOptions {
  /** The card's words; `{duration}` shows the length cut, as "38 s". "{duration} skipped" by default. */
  label?: string;
  /** A panel with a clock ring in the middle (`clock`, the default), or a bar along the bottom (`bar`). */
  style?: SkipStyle;
}
export interface ZoomOutOptions {
  /** How long the return to the full screen takes, in milliseconds; 800 by default. */
  ms?: number;
}

export const ZOOM_IN_MS = 650;
export const ZOOM_OUT_MS = 800;
export const DEFAULT_SCALE = 4 / 3;

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

/** Checks `speedUp`'s factor: above 1 and at most 16, fractions allowed (GH-61 decision 001). */
export function speedFactor(value: unknown): number {
  if (typeof value !== "number" || !(value > 1 && value <= MAX_SPEED)) {
    throw new Error(`speedUp(): the factor must be a number above 1 and at most ${MAX_SPEED}, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Checks `skip`'s options (GH-62 decision 002, GH-76 decision 008). */
export function skipSettings(value?: unknown): { label: string; style: SkipStyle } {
  const o = options<SkipOptions>("skip", value, ["label", "style"]);
  const style = o.style ?? "clock";
  if (!SKIP_STYLES.includes(style)) throw new Error(`skip(): style must be "clock" or "bar", got ${JSON.stringify(o.style)}`);
  if (o.label === undefined) return { label: "{duration} skipped", style };
  if (typeof o.label !== "string" || !o.label.trim()) throw new Error(`skip(): label must be non-empty text, got ${JSON.stringify(o.label)}`);
  return { label: o.label, style };
}

/** A length in whole seconds, as a card shows it: "38 s", "1 min 52 s", "2 min" (GH-62 decision 002). */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const rest = seconds % 60;
  return `${Math.floor(seconds / 60)} min${rest ? ` ${rest} s` : ""}`;
}


export const zoomInEvent = (t: number, at: Point, bounds: Bounds | undefined, settings: { scale: number; ms: number }): ZoomEvent =>
  ({ t, type: "zoom", zoom: "in", at, ...(bounds ? { bounds } : {}), ...settings });
export const zoomOutEvent = (t: number, settings: { ms: number }): ZoomEvent => ({ t, type: "zoom", zoom: "out", ...settings });

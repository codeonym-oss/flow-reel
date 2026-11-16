// The event log: v1 actions (story decision 013), v2 added sound cues, v3 names them `sound` (GH-30 decision 003),
// v4 adds effects and `autoZoom` (GH-32 decision 005), v5 adds `speed` (GH-61 decision 005)
// and `skip` (GH-62 decision 004).
import { type Errors, isObject, nonNegative, point, text } from "./check.ts";

export type Point = [x: number, y: number];
export interface Bounds { x: number; y: number; width: number; height: number }

// A script names a sound by a constant (GH-30 decisions 004 and 005), so `Sound` is branded: a bare string isn't one.
declare const brand: unique symbol;
const SOUND_GROUPS = {
  feedback: { SUCCESS: "success", ERROR: "error", NOTIFICATION: "notification" },
  navigation: { OPEN: "open", CLOSE: "close", BACK: "back" },
  controls: { TOGGLE: "toggle", SELECT: "select" },
} as const;
type Groups = typeof SOUND_GROUPS;
/** What the event log records for a sound. */
export type SoundName = { [G in keyof Groups]: Groups[G][keyof Groups[G]] }[keyof Groups];
/** A sound a script can play: one of the `Sounds` constants. */
export type Sound = SoundName & { readonly [brand]: true };
/** The sounds a script can play, grouped by what they mean. Clicks and typing sound by themselves. */
export const Sounds = SOUND_GROUPS as { readonly [G in keyof Groups]: { readonly [K in keyof Groups[G]]: Sound } };
export const SOUND_NAMES = Object.values(SOUND_GROUPS).flatMap((group) => Object.values(group)) as SoundName[];

export type ComposerEvent =
  | { t: number; type: "move"; from: Point; to: Point; durationMs: number; easing: string }
  | { t: number; type: "click"; at: Point; button: "left" | "right" | "middle"; target: string; bounds?: Bounds }
  | { t: number; type: "type"; text: string; charDelayMs: number; target: string; bounds?: Bounds }
  | { t: number; type: "scroll"; delta: Point; durationMs: number }
  | { t: number; type: "sound"; name: SoundName }
  | FlashEvent | FrameEvent | ZoomEvent | SpeedEvent | SkipEvent;

export type Fit = "contain" | "cover";
export interface FlashEvent { t: number; type: "flash"; color: string; ms: number }
/** `image` is relative to the script's folder; `sha256` names the exact image used. */
export interface FrameEvent {
  t: number; type: "frame"; image: string; sha256: string; durationMs: number; fit: Fit; background: string;
}
/** A zoom in frames `bounds` when an element was the target, else the point `at`. */
export type ZoomEvent =
  | { t: number; type: "zoom"; zoom: "in"; at: Point; bounds?: Bounds; scale: number; ms: number }
  | { t: number; type: "zoom"; zoom: "out"; ms: number };
/** A stretch played `factor` times faster; `durationMs` is how long it lasts on the event log's clock. */
export interface SpeedEvent { t: number; type: "speed"; factor: number; durationMs: number }
/** A stretch cut from the video and shown as a card; `durationMs` is the length cut, `label` the card's words. */
export interface SkipEvent { t: number; type: "skip"; durationMs: number; label: string }

export interface EventLog {
  version: 5;
  /** False when the script turned automatic zoom off. */
  autoZoom: boolean;
  events: ComposerEvent[];
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
export const FITS: readonly Fit[] = ["contain", "cover"];
export const MAX_ZOOM = 2;
export const MAX_SPEED = 16;

export function validateEvents(value: unknown): Errors {
  const errors: Errors = [];
  if (!isObject(value)) return ["events log must be an object"];
  if (value.version !== 5) errors.push("version must be 5");
  if (typeof value.autoZoom !== "boolean") errors.push("autoZoom must be true or false");
  if (!Array.isArray(value.events)) return [...errors, "events must be an array"];

  value.events.forEach((event, i) => {
    const where = `events[${i}]: `;
    if (!isObject(event)) return void errors.push(`${where}must be an object`);
    nonNegative(errors, where, event, "t");
    const positive = (key: string) => {
      const v = event[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) errors.push(`${where}${key} must be a number > 0`);
    };
    const color = (key: string) => {
      if (typeof event[key] !== "string" || !HEX_COLOR.test(event[key] as string)) errors.push(`${where}${key} must be a #rrggbb colour`);
    };
    if ((event.type === "click" || event.type === "type" || event.type === "zoom") && event.bounds !== undefined) {
      const b = event.bounds;
      if (!isObject(b) || ![b.x, b.y, b.width, b.height].every((v) => typeof v === "number" && Number.isFinite(v)) ||
        Number(b.width) <= 0 || Number(b.height) <= 0) errors.push(`${where}bounds must have finite x/y and positive width/height`);
    }
    switch (event.type) {
      case "sound":
        if (!SOUND_NAMES.includes(event.name as SoundName)) errors.push(`${where}unknown sound ${JSON.stringify(event.name)}`);
        break;
      case "move":
        point(errors, where, event, "from");
        point(errors, where, event, "to");
        nonNegative(errors, where, event, "durationMs");
        text(errors, where, event, "easing");
        break;
      case "click":
        point(errors, where, event, "at");
        if (!["left", "right", "middle"].includes(event.button as string)) errors.push(`${where}button is invalid`);
        text(errors, where, event, "target");
        break;
      case "type":
        text(errors, where, event, "text");
        nonNegative(errors, where, event, "charDelayMs");
        text(errors, where, event, "target");
        break;
      case "scroll":
        point(errors, where, event, "delta");
        nonNegative(errors, where, event, "durationMs");
        break;
      case "flash":
        color("color");
        positive("ms");
        break;
      case "frame": {
        const image = event.image;
        if (typeof image !== "string" || !image || image.startsWith("/") ||
          image.split("/").some((part) => !part || part === "." || part === "..")) {
          errors.push(`${where}image must be a path relative to the script's folder, without . or ..`);
        }
        if (typeof event.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(event.sha256)) errors.push(`${where}sha256 must be a SHA-256 hex digest`);
        positive("durationMs");
        if (!FITS.includes(event.fit as Fit)) errors.push(`${where}fit must be "contain" or "cover"`);
        color("background");
        break;
      }
      case "zoom":
        positive("ms");
        if (event.zoom === "in") {
          point(errors, where, event, "at");
          const scale = event.scale;
          if (typeof scale !== "number" || !(scale >= 1 && scale <= MAX_ZOOM)) errors.push(`${where}scale must be from 1 to ${MAX_ZOOM}`);
        } else if (event.zoom !== "out") errors.push(`${where}zoom must be "in" or "out"`);
        break;
      case "speed": {
        const factor = event.factor;
        if (typeof factor !== "number" || !(factor > 1 && factor <= MAX_SPEED)) errors.push(`${where}factor must be above 1 and at most ${MAX_SPEED}`);
        nonNegative(errors, where, event, "durationMs");
        break;
      }
      case "skip":
        nonNegative(errors, where, event, "durationMs");
        if (typeof event.label !== "string" || !event.label.trim()) errors.push(`${where}label must be non-empty text`);
        break;
      default:
        errors.push(`${where}unknown type ${JSON.stringify(event.type)}`);
    }
  });
  return errors;
}

// The public API a script imports (GH-27 decisions 001 and 008; GH-30 decisions 001-005; GH-32 decisions 001-006;
// GH-61).
import type { Page } from "playwright";
import type { Sound } from "./composer/schema/events.ts";
import type { FlashOptions, ShowFrameOptions, SkipOptions, ZoomInOptions, ZoomOutOptions } from "./composer/effects.ts";
export { Sounds, type Sound } from "./composer/schema/events.ts";
export type { FlashOptions, ShowFrameOptions, SkipOptions, ZoomInOptions, ZoomOutOptions } from "./composer/effects.ts";

declare module "playwright-core" {
  interface Locator {
    /** Speaks `text` as this element's step: the step opens with the next action. */
    comment(text: string): Locator;
    /** Plays `sound` when this locator's next action happens. */
    sound(sound: Sound): Locator;
    /** Flashes the screen when this locator's next action happens. */
    flash(options?: FlashOptions): Locator;
    /** Zooms in on this element as the pointer heads for it; the zoom holds until `zoomOut`. */
    zoomIn(options?: ZoomInOptions): Locator;
    /** Zooms back out to the full screen after this locator's next action. */
    zoomOut(options?: ZoomOutOptions): Locator;
  }
}

export interface ScriptOptions {
  /** Where the script starts: the URL the agent used while exploring. */
  url: string;
  /** CSS pixels; the composer records at device scale 4/3. */
  viewport?: [width: number, height: number];
  /** False turns automatic zoom off; the cursor, the click ripple and `zoomIn` still work. True by default. */
  autoZoom?: boolean;
}

export interface ScriptContext {
  page: Page;
  /** Speaks `text`. It opens a step, which starts with the next action; not awaited. */
  comment(text: string): void;
  /** Plays `sound` at this moment. */
  sound(sound: Sound): void;
  /** Flashes the screen at this moment. */
  flash(options?: FlashOptions): void;
  /**
   * Shows `image` (a PNG, JPEG or WebP in the script's folder, relative to the script) for `ms` milliseconds, inserted
   * into the video; the app is shown again exactly where it was. An action of its step.
   */
  showFrame(image: string, ms: number, options?: ShowFrameOptions): Promise<void>;
  /** Zooms in on wherever the pointer is; the zoom holds until `zoomOut`, and automatic zoom waits meanwhile. */
  zoomIn(options?: ZoomInOptions): void;
  /** Zooms back out to the full screen. */
  zoomOut(options?: ZoomOutOptions): void;
  /**
   * Runs `fn` as one action, played `factor` times faster in the video (above 1, at most 16), with a "▶▶ ×N" badge in
   * the top-right corner. For waits: only actions, sounds, `flash` and zoom go inside; `comment`, `showFrame` and
   * another `speedUp` or a `skip` throw. A comment spoken over it keeps its normal speed.
   */
  speedUp(factor: number, fn: () => Promise<unknown>): Promise<void>;
  /**
   * Runs `fn` as one action, cut from the video: a card on the dimmed last frame shows "⏭ 38 s skipped" instead, for
   * at least 1.5 s or until the comment spoken over it ends. `label` replaces the words after "⏭"; `{duration}` in it
   * shows the length cut. For waits: only actions and sounds go inside, and nothing of them is seen or heard;
   * `comment`, `showFrame`, `flash`, zoom, `speedUp` and another `skip` throw.
   */
  skip(fn: () => Promise<unknown>, options?: SkipOptions): Promise<void>;
}

export type ScriptBody = (context: ScriptContext) => Promise<void>;

export interface Script {
  options: Required<ScriptOptions>;
  body: ScriptBody;
}

/** Describes a script; the composer composes it. */
export function script(options: ScriptOptions, body: ScriptBody): Script {
  return { options: { viewport: [1920, 1080], autoZoom: true, ...options }, body };
}

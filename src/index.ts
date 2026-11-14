// The public API a script imports (GH-27 decisions 001 and 008; GH-30 decisions 001-005).
import type { Page } from "playwright";
import type { Sound } from "./composer/schema/events.ts";
export { Sounds, type Sound } from "./composer/schema/events.ts";

declare module "playwright-core" {
  interface Locator {
    /** Speaks `text` as this element's step: the step opens with the next action. */
    comment(text: string): Locator;
    /** Plays `sound` when this locator's next action happens. */
    sound(sound: Sound): Locator;
  }
}

export interface ScriptOptions {
  /** Where the script starts: the URL the agent used while exploring. */
  url: string;
  /** CSS pixels; the composer records at device scale 4/3. */
  viewport?: [width: number, height: number];
}

export interface ScriptContext {
  page: Page;
  /** Speaks `text`. It opens a step, which starts with the next action; not awaited. */
  comment(text: string): void;
  /** Plays `sound` at this moment. */
  sound(sound: Sound): void;
}

export type ScriptBody = (context: ScriptContext) => Promise<void>;

export interface Script {
  options: Required<ScriptOptions>;
  body: ScriptBody;
}

/** Describes a script; the composer composes it. */
export function script(options: ScriptOptions, body: ScriptBody): Script {
  return { options: { viewport: [1920, 1080], ...options }, body };
}

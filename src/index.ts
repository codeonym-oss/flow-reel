// The public API a demo script imports (story decision 010).
import type { Page } from "playwright";

export interface DemoOptions {
  /** Where the demo starts: the URL the agent used while exploring. */
  url: string;
  /** CSS pixels; the runner records at device scale 4/3. */
  viewport?: [width: number, height: number];
}

/** One unit the runner times, voices and holds: the narration, and the action it describes. */
export type Step = (narration: string, action: () => Promise<unknown>) => Promise<void>;

export type DemoBody = (context: { page: Page; step: Step }) => Promise<void>;

export interface Demo {
  options: Required<DemoOptions>;
  body: DemoBody;
}

/** Describes a demo; the runner runs it. */
export function demo(options: DemoOptions, body: DemoBody): Demo {
  return { options: { viewport: [1920, 1080], ...options }, body };
}

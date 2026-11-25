import type { Theme, Transition } from "./brand.ts";
import type { BuiltInKind } from "./catalog.ts";

/** One card to draw: what it shows, how it looks, and where it sits in the capture. */
export interface CardJob {
  /** Its id in the timeline: `card<i>` or `skip<i>`. */
  id: string;
  kind: BuiltInKind | "custom";
  props: Record<string, unknown>;
  /** A custom card's page, relative to the scripts folder. */
  page?: string;
  theme: Theme;
  enter: Transition;
  exit: Transition;
  /** How many video frames it lasts, transitions included. */
  frames: number;
  /** The source frame it is inserted before: the app frame after it; the one before is `frame - 1`. */
  frame: number;
  chapter?: { number: number; total: number };
}

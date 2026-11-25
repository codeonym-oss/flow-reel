// plan.json: everything the render needs to know, decided before ffmpeg or a browser draws anything.
import type { CardJob } from "../cards/job.ts";
import type { Timeline } from "../timeline.ts";
import { type Errors, isObject } from "./check.ts";
import type { EventLog } from "./events.ts";

export interface Plan {
  version: 1;
  viewport: [width: number, height: number];
  fps: number;
  /** False when the compose mutes every sound. */
  sound: boolean;
  timeline: Timeline;
  /** Each card to draw. */
  cards: CardJob[];
  /** The reel's event log, on the finished video's clock. */
  log: EventLog;
}

/** The plan is written and read by flow-reel alone: its version is what can differ. */
export function validatePlan(value: unknown): Errors {
  if (!isObject(value)) return ["plan must be an object"];
  return value.version === 1 ? [] : ["version must be 1"];
}

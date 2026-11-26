// How long a phase may take (GH-118): the ones that can hang, because they wait for an app, a provider or ffmpeg.
import type { Phase } from "../run/phases.ts";

export const LIMITED = ["record", "voice", "render"] as const;
export type LimitedPhase = typeof LIMITED[number];

/** Minutes. */
export type Limits = Record<LimitedPhase, number>;

/** A day: more is no limit, and a timer can only count so far. */
export const LONGEST = 1440;

export const DEFAULT_LIMITS: Limits = { record: 60, voice: 60, render: 120 };

/** How many finished runs of a script keep their heavy files. */
export const DEFAULT_KEEP_RUNS = 5;

const DOING: Record<LimitedPhase, string> = { record: "recording", voice: "voicing", render: "rendering" };

export const limitMs = (limits: Limits, phase: Phase): number | undefined =>
  (LIMITED as readonly Phase[]).includes(phase) ? limits[phase as LimitedPhase] * 60_000 : undefined;

export const overLimit = (limits: Limits, phase: LimitedPhase): string =>
  `${DOING[phase]} took longer than its limit of ${limits[phase]} minutes (limits.${phase} in flow-reel.json)`;

// A run's phases, in order, and what each one's result was made from (epic GH-107 decision 031, GH-108 decision 015).
// Pure: no Node, Docker, SQL or ffmpeg here.

export const PHASES = ["record", "voice", "plan", "render", "publish"] as const;
export type Phase = typeof PHASES[number];

/** The phases whose result is a folder of the run; publishing puts the reel in the project instead. */
export const RESULTS = ["record", "voice", "plan", "render"] as const;
export type ResultPhase = typeof RESULTS[number];

/** The earlier results each phase reads. */
export const INPUTS: Record<Phase, readonly ResultPhase[]> = {
  record: [],
  voice: ["record"],
  plan: ["record", "voice"],
  render: ["record", "voice", "plan"],
  publish: ["record", "voice", "plan", "render"],
};

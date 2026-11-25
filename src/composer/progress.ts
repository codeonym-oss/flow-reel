// What a phase says while it works. Nothing depends on these: they are for the person watching.
export type PhaseProgress =
  /** The script reached a step. */
  | { type: "step"; index: number; comment?: string }
  /** The comments are spoken: some by the voice, some reused from the reel being replaced. */
  | { type: "voiced"; spoken: number; reused: number }
  /** The render started one of its parts. */
  | { type: "drawing"; what: "cards" | "overlays" | "picture" };

export type Report = (progress: PhaseProgress) => void;

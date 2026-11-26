// What a phase says while it works. Nothing depends on these: they are for the person watching.
export type PhaseProgress =
  /** The script reached a step. */
  | { type: "step"; index: number; comment?: string }
  /** The comments are spoken: some by the voice, some reused from the reel being replaced. */
  | { type: "voiced"; spoken: number; reused: number }
  /** The script clicked or typed into a target: its locator, and its box as shares of the viewport (GH-138 decision 004). */
  | { type: "target"; target: string; box: [x: number, y: number, width: number, height: number] }
  /** The render started one of its parts. */
  | { type: "drawing"; what: "cards" | "overlays" | "picture" };

export type Report = (progress: PhaseProgress) => void;

// The composer's ports (GH-27 decision 007; the card painter, GH-76 decision 003). The core depends on these interfaces; the adapters in
// src/adapters implement them, and src/cli.ts chooses which.
import type { Bounds, ComposerEvent, OverlayKind, Sound } from "./schema/events.ts";
import type { cardWords } from "./cards/words.ts";
import type { Transcript } from "./schema/transcript.ts";

export interface ClipRequest { index: number; text: string; file: string }

/** Speaks comments: writes one WAV per clip request. */
export interface Voice {
  /** How the transcript names this voice. */
  voice: NonNullable<Transcript["voice"]>;
  synthesize(jobs: readonly ClipRequest[]): Promise<void>;
}

/** What the composer gives a script while it runs. */
export interface Stage {
  /** Milliseconds on the recording's clock. */
  clock: { now(): number };
  events: ComposerEvent[];
  fps: number;
  /** Queues a comment: it opens the next step. */
  comment(text: string): void;
  sound(sound: Sound): void;
  /** Runs one action of the script inside its step, opening the step first when one is due. */
  action<T>(run: () => Promise<T>): Promise<T>;
  /** Runs `run` as an action of its step, played `factor` times faster in the video (GH-61). */
  speedUp(factor: number, run: () => Promise<unknown>): Promise<void>;
  /** Runs `run` as an action of its step, cut from the video and shown as a card (GH-62). */
  skip(run: () => Promise<unknown>, options?: unknown): Promise<void>;
  /** Throws when the effect word `word` can't be used here: inside a skip, nothing is seen (GH-62 decision 004). */
  checkEffect(word: string): void;
  /** The `card` words: each inserts a card into the video, as an action of its step (GH-76 decision 002). */
  card: ReturnType<typeof cardWords>;
  /**
   * Shows an overlay as an action of its step, until the script's next action (GH-76 decision 007): `bounds` finds the
   * element a callout or a highlight points at.
   */
  overlay(kind: OverlayKind, props: Record<string, unknown>, options: unknown, bounds?: () => Promise<Bounds | undefined>): Promise<void>;
}

/** One script, open in its E2E tool and ready to replay. */
export interface Session {
  /** Resolves to true once the app has stopped loading, or to false when it is still loading after a timeout. */
  idle(): Promise<boolean>;
  /** Fills the screen with one colour, so the composer can find that moment in the recording. */
  showMarker(rgb: [number, number, number]): Promise<void>;
  hideMarker(): Promise<void>;
  /** Runs the script from start to end. */
  run(stage: Stage): Promise<void>;
  close(): Promise<void>;
}

export interface LoadedScript {
  /** CSS pixels. */
  viewport: [width: number, height: number];
  /** False when the script turned automatic zoom off. */
  autoZoom: boolean;
  /** Opens the app on the composer's display, which must already be running. */
  open(): Promise<Session>;
}

/** The adapter for one E2E tool. */
export interface Integration {
  /** How the manifest names this integration. */
  name: string;
  load(scriptPath: string): Promise<LoadedScript>;
}

/** Where finished reels are kept. */
export interface ReelStore {
  /** Puts a finished reel, the folder `built`, at `reel`, replacing the one there only once the new one is complete. */
  publish(built: string, reel: string): Promise<void>;
}

/** One card page to draw, frame by frame. */
export interface PaintRequest {
  /** The page's URL on the card origin; its HTML is `html`. */
  url: string;
  html: string;
  /** The file to serve for a path on the card origin, or undefined: nothing else may load, the network is off. */
  file(pathname: string): string | undefined;
  /** CSS pixels, drawn at device scale `scale`. */
  viewport: [width: number, height: number];
  scale: number;
  /** When to draw each frame, in milliseconds after the page loaded, in order. */
  times: readonly number[];
  /** Where frame `i` (drawn at `times[i]`) goes, as a PNG. */
  frame(i: number): string;
  /** Draws on a transparent page, for an overlay. */
  transparent?: boolean;
}

/** Draws card and overlay pages on a frozen clock. */
export interface CardPainter {
  open(): Promise<{ paint(request: PaintRequest): Promise<void>; close(): Promise<void> }>;
}

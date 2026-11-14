// The composer's three ports (GH-27 decision 007). The core depends on these interfaces; the adapters in
// src/adapters implement them, and src/cli.ts chooses which.
import type { ComposerEvent, EventLog, Sound } from "./schema/events.ts";
import type { ManifestAbout } from "./schema/manifest.ts";
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
  /** Opens the app on the composer's display, which must already be running. */
  open(): Promise<Session>;
}

/** The adapter for one E2E tool. */
export interface Integration {
  /** How the manifest names this integration. */
  name: string;
  load(scriptPath: string): Promise<LoadedScript>;
}

export interface ReelResult {
  transcript: Transcript;
  events: EventLog;
  captions: { srt: string; vtt: string };
  /** What the manifest says about how the reel was composed; the store adds the file list. */
  about: ManifestAbout;
}

/** Where one script's reel is built: its work files, its audio, and the step that publishes it. */
export interface Reel {
  /** Intermediate files; the composer writes them, nothing reads them afterwards except to debug. */
  work: { capture: string; master: string; masterInfo: string; stagedVideo: string; voiceBus: string };
  /** Where the voice's clips go. */
  audioDir: string;
  /** The folder a clip's transcript path (`audio/000.wav`) is relative to. */
  audioRoot: string;
  /** The finished video's file name, as the transcript records it. */
  videoFile: string;
  /** Writes the transcript, captions, event log and manifest, and replaces the previous reel with this one. */
  commit(result: ReelResult): void;
}

export interface ReelStore {
  /** Starts a new reel for `scriptPath`, beside it or inside `outDir`. */
  open(scriptPath: string, outDir?: string): Reel;
}

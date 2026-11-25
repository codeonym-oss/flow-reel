// The second phase: speaks the cue sheet's comments. It runs in the composer's container, the only one that gets a key.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { voiceSteps } from "../media/voicing.ts";
import type { Voice } from "../ports.ts";
import type { Report } from "../progress.ts";
import type { CueSheet } from "../schema/cues.ts";
import { VOICED_FILE } from "../schema/files.ts";
import type { Voiced } from "../schema/voiced.ts";

export interface VoiceJob {
  cues: CueSheet;
  /** The reel being replaced, whose clips may be reused (the reel cache, GH-33 decision 002). */
  previous: string;
  /** Where the clips go, in `audio/`, and voice.json. */
  out: string;
}

export async function voice({ cues, previous, out }: VoiceJob, adapter: Voice, report: Report): Promise<void> {
  const { voice, steps, voiced, reused } = await voiceSteps(cues.steps, join(out, "audio"), adapter, previous);
  report({ type: "voiced", spoken: voiced, reused });
  const result: Voiced = { version: 1, voice, clips: steps.flatMap(({ index, audio }) => audio ? [{ step: index, audio }] : []) };
  writeFileSync(join(out, VOICED_FILE), `${JSON.stringify(result, null, 2)}\n`);
}

// What a finished reel says, put together from the results of a run's phases. Pure; the host writes the files.
import { renderCaptions } from "./captions.ts";
import type { CueSheet } from "./schema/cues.ts";
import type { EventLog } from "./schema/events.ts";
import type { ManifestAbout } from "./schema/manifest.ts";
import type { Plan } from "./schema/plan.ts";
import { validateSync } from "./schema/sync.ts";
import type { Transcript } from "./schema/transcript.ts";
import type { Voiced } from "./schema/voiced.ts";

export interface ReelText {
  transcript: Transcript;
  events: EventLog;
  captions: { srt: string; vtt: string };
  /** What the manifest says about how the reel was composed; the file list is added when the files are written. */
  about: ManifestAbout;
}

export function reelText({ cues, voiced, plan, durationMs, video, composerVersion }: { cues: CueSheet; voiced: Voiced; plan: Plan;
  /** The finished video's length and file name. */
  durationMs: number; video: string; composerVersion: string }): ReelText {
  const transcript: Transcript = {
    version: 2,
    script: cues.script.file,
    video: { file: video, width: plan.viewport[0], height: plan.viewport[1], fps: plan.fps, durationMs },
    voice: voiced.voice, steps: plan.timeline.steps,
  };
  const errors = validateSync(transcript);
  if (errors.length) throw new Error(`recording is invalid:\n  ${errors.join("\n  ")}`);
  return { transcript, events: plan.log, captions: renderCaptions(transcript.steps), about: {
    script: cues.script,
    composer: { version: composerVersion, platform: cues.platform },
    integration: cues.integration,
    voice: voiced.voice,
  } };
}

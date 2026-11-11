import type { RunnerEvent } from "../schema/events.ts";
import type { TranscriptStep } from "../schema/transcript.ts";

/** A hold clones frame - 1 before source frame `frame` (indices include calibration pre-roll). */
export interface Hold { frame: number; frames: number }
export interface Timeline {
  fps: number;
  sourceFrames: number;
  cutFrames: number;
  frames: number;
  holds: Hold[];
  steps: TranscriptStep[];
  mapTime(ms: number): number;
}

export function planTimeline(
  steps: readonly TranscriptStep[], { fps, frames, cutMs }: { fps: number; frames: number; cutMs: number },
): Timeline {
  const cutFrames = Math.round(cutMs * fps / 1000);
  const holds: Hold[] = [];
  let added = 0;
  const ms = (frames: number) => frames * 1000 / fps;
  const finalSteps = steps.map((step) => {
    const frame = Math.ceil((step.endMs + ms(cutFrames)) * fps / 1000 - 1e-9);
    if (frame <= 0 || frame > frames) throw new Error(`step ${step.index} extends beyond the capture`);
    const visualEnd = ms(frame - cutFrames);
    const needed = step.audio ? step.startMs + step.audio.durationMs + 200 : visualEnd;
    const extra = Math.max(0, Math.ceil((needed - visualEnd) * fps / 1000 - 1e-9));
    const result = { ...step, startMs: step.startMs + ms(added), actionEndMs: step.actionEndMs + ms(added),
      endMs: visualEnd + ms(added + extra) };
    if (extra) holds.push({ frame, frames: extra });
    added += extra;
    return result;
  });
  return {
    fps, sourceFrames: frames, cutFrames, frames: frames + added, holds, steps: finalSteps,
    mapTime(t) {
      const extra = holds.filter((h) => t >= ms(h.frame - cutFrames) - 1e-9).reduce((n, h) => n + h.frames, 0);
      return t + ms(extra);
    },
  };
}

export function retimeEvents(events: readonly RunnerEvent[], timeline: Timeline): RunnerEvent[] {
  return events.map((event) => ({ ...event, t: timeline.mapTime(event.t) }));
}

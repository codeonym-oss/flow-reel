// The video's timeline: the capture plus insertions (GH-32 decision 003). A hold repeats the frame before it, so a
// comment can finish; an image shows a `showFrame` picture. Both are placed at a capture frame, and every time on the
// capture's clock moves to the video's through one mapping, `mapTime`.
import type { ComposerEvent, Fit } from "./schema/events.ts";
import type { TranscriptStep } from "./schema/transcript.ts";

export interface InsertedImage { file: string; fit: Fit; background: string }
/**
 * Inserts `frames` frames before source frame `frame` (indices include calibration pre-roll): clones of frame - 1
 * for a hold, or `image`. `startMs` is where it starts in the video.
 */
export interface Insertion { frame: number; frames: number; image?: InsertedImage }
/** A `showFrame` call: when it was made on the capture's clock, for how long, and the checked image. */
export interface TimelineImage extends InsertedImage { t: number; durationMs: number }
export interface Timeline {
  fps: number;
  sourceFrames: number;
  cutFrames: number;
  frames: number;
  /** In video order; at one frame, holds come before images, and images keep the order they were shown in. */
  insertions: Insertion[];
  /** Where each image starts and ends in the video, in the order the images were shown. */
  imageSpans: { startMs: number; endMs: number }[];
  steps: TranscriptStep[];
  /** Moves a time on the capture's clock to the video's; a time at an insertion's frame lands after it. */
  mapTime(ms: number): number;
}

export function planTimeline(
  steps: readonly TranscriptStep[],
  { fps, frames, cutMs, images = [] }: { fps: number; frames: number; cutMs: number; images?: readonly TimelineImage[] },
): Timeline {
  const cutFrames = Math.round(cutMs * fps / 1000);
  const ms = (n: number) => n * 1000 / fps;
  const frameAt = (t: number) => Math.ceil((t + ms(cutFrames)) * fps / 1000 - 1e-9);
  const imageInsertions = images.map(({ t, durationMs, file, fit, background }): Insertion => {
    const frame = frameAt(t);
    if (frame <= 0 || frame > frames) throw new Error(`an image shown at ${Math.round(t)} ms is beyond the capture`);
    return { frame, frames: Math.max(1, Math.round(durationMs * fps / 1000)), image: { file, fit, background } };
  });
  const insertions: Insertion[] = [...imageInsertions];
  const order = () => insertions.sort((a, b) => a.frame - b.frame || Number(Boolean(a.image)) - Number(Boolean(b.image)));
  order();
  const mapWith = (t: number) =>
    t + ms(insertions.filter((i) => t >= ms(i.frame - cutFrames) - 1e-9).reduce((n, i) => n + i.frames, 0));
  const finalSteps = steps.map((step) => {
    const frame = frameAt(step.endMs);
    if (frame <= 0 || frame > frames) throw new Error(`step ${step.index} extends beyond the capture`);
    const startMs = mapWith(step.startMs);
    // The step's picture ends at its frame, after whatever was inserted inside the step.
    const visualEnd = ms(frame - cutFrames) + ms(insertions.filter((i) => i.frame < frame).reduce((n, i) => n + i.frames, 0));
    const needed = step.audio ? startMs + step.audio.durationMs + 200 : visualEnd;
    const extra = Math.max(0, Math.ceil((needed - visualEnd) * fps / 1000 - 1e-9));
    const result = { ...step, startMs, actionEndMs: mapWith(step.actionEndMs), endMs: visualEnd + ms(extra) };
    if (extra) {
      insertions.push({ frame, frames: extra });
      order();
    }
    return result;
  });
  const imageSpans = imageInsertions.map((image) => {
    const before = insertions.slice(0, insertions.indexOf(image)).reduce((n, i) => n + i.frames, 0);
    const startMs = ms(image.frame - cutFrames + before);
    return { startMs, endMs: startMs + ms(image.frames) };
  });
  return {
    fps, sourceFrames: frames, cutFrames, frames: frames + insertions.reduce((n, i) => n + i.frames, 0),
    insertions, imageSpans, steps: finalSteps, mapTime: mapWith,
  };
}

/** Each frame event moves to where its image starts in the video; every other event through `mapTime`. */
export function retimeEvents(events: readonly ComposerEvent[], timeline: Timeline): ComposerEvent[] {
  let image = 0;
  return events.map((event) => ({
    ...event, t: event.type === "frame" ? timeline.imageSpans[image++].startMs : timeline.mapTime(event.t),
  }));
}

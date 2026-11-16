// The video's timeline: the capture plus insertions (GH-32 decision 003). A hold repeats the frame before it, so a
// comment can finish; an image shows a `showFrame` picture. Both are placed at a capture frame, and every time on the
// capture's clock moves to the video's through one mapping, `mapTime`. A stretch (GH-61) plays a run of capture
// frames faster: output frame i of it is source frame floor(i × factor), so it keeps ceil(frames / factor) of them
// (GH-61 decisions 007 and 008). A skip (GH-62) cuts a run of capture frames and inserts a card in their place: the
// frame before them, held for at least 1.5 s or until the step's comment ends (GH-62 decision 003).
import { cardText } from "./effects.ts";
import type { ComposerEvent, Fit } from "./schema/events.ts";
import type { TranscriptStep } from "./schema/transcript.ts";

export interface InsertedImage { file: string; fit: Fit; background: string }
/**
 * Inserts `frames` frames before source frame `frame` (indices include calibration pre-roll): clones of frame - 1
 * for a hold, or `image`. `startMs` is where it starts in the video.
 */
export interface Insertion { frame: number; frames: number; image?: InsertedImage; card?: { text: string } }
/** A `showFrame` call: when it was made on the capture's clock, for how long, and the checked image. */
export interface TimelineImage extends InsertedImage { t: number; durationMs: number }
/** A `speedUp` call: when it started on the capture's clock, how long it ran, and its factor. */
export interface TimelineSpeedUp { t: number; durationMs: number; factor: number }
/** A `skip` call: when it started on the capture's clock, how long it ran, and its card's label. */
export interface TimelineSkip { t: number; durationMs: number; label: string }
/**
 * Source frames [frame, frame + frames) (indices include calibration pre-roll), shown as `kept` frames; `startMs` and
 * `endMs` are where it plays in the video.
 */
export interface Stretch { frame: number; frames: number; kept: number; factor: number; startMs: number; endMs: number }
export interface Timeline {
  fps: number;
  sourceFrames: number;
  cutFrames: number;
  frames: number;
  /** In video order; at one frame, holds come before images, and images keep the order they were shown in. */
  insertions: Insertion[];
  /** Where each image starts and ends in the video, in the order the images were shown. */
  imageSpans: { startMs: number; endMs: number }[];
  /** In video order; none overlaps an insertion. */
  stretches: Stretch[];
  /** Source frames [frame, frame + frames) that skips cut, in source order. */
  skips: { frame: number; frames: number }[];
  /** Where each skip's card starts and ends in the video, and its words, in the order the skips ran. */
  cardSpans: { startMs: number; endMs: number; text: string }[];
  steps: TranscriptStep[];
  /** Moves a time on the capture's clock to the video's; a time at an insertion's frame lands after it. */
  mapTime(ms: number): number;
  /** How long `durationMs` from capture time `t` lasts in the video: shorter by what stretches drop inside it. */
  mapDuration(t: number, durationMs: number): number;
}

// A card shows for at least this long (GH-62 decision 003).
const CARD_MS = 1500;

export function planTimeline(
  steps: readonly TranscriptStep[],
  { fps, frames, cutMs, images = [], speedUps = [], skips = [] }:
    { fps: number; frames: number; cutMs: number; images?: readonly TimelineImage[]; speedUps?: readonly TimelineSpeedUp[];
      skips?: readonly TimelineSkip[] },
): Timeline {
  const cutFrames = Math.round(cutMs * fps / 1000);
  const ms = (n: number) => n * 1000 / fps;
  const frameAt = (t: number) => Math.ceil((t + ms(cutFrames)) * fps / 1000 - 1e-9);
  const imageInsertions = images.map(({ t, durationMs, file, fit, background }): Insertion => {
    const frame = frameAt(t);
    if (frame <= 0 || frame > frames) throw new Error(`an image shown at ${Math.round(t)} ms is beyond the capture`);
    return { frame, frames: Math.max(1, Math.round(durationMs * fps / 1000)), image: { file, fit, background } };
  });
  const sped = speedUps.map(({ t, durationMs, factor }) => {
    const frame = frameAt(t);
    const end = frameAt(t + durationMs);
    if (frame <= 0 || end > frames) throw new Error(`a speed-up at ${Math.round(t)} ms is beyond the capture`);
    return { frame, frames: end - frame, kept: Math.ceil((end - frame) / factor), factor };
  }).filter((s) => s.frames > 0);
  const cut = skips.map(({ t, durationMs, label }) => {
    const frame = frameAt(t);
    const end = frameAt(t + durationMs);
    if (frame <= 0 || end > frames) throw new Error(`a skip at ${Math.round(t)} ms is beyond the capture`);
    return { t, frame, frames: end - frame, kept: 0, factor: Infinity, text: cardText(label, durationMs) };
  });
  // Frames the stretches and skips drop before source frame `at` (fractional inside a stretch, so times inside it scale).
  const dropped = (at: number) => [...sped, ...cut].reduce((n, s) => n + (at <= s.frame ? 0 : at >= s.frame + s.frames - 1e-9
    ? s.frames - s.kept : (at - s.frame) * (1 - 1 / s.factor)), 0);
  const sourceAt = (t: number) => t * fps / 1000 + cutFrames;
  const insertions: Insertion[] = [...imageInsertions];
  const order = () => insertions.sort((a, b) => a.frame - b.frame ||
    Number(Boolean(a.image || a.card)) - Number(Boolean(b.image || b.card)));
  order();
  const mapWith = (t: number) => t - ms(dropped(sourceAt(t))) +
    ms(insertions.filter((i) => t >= ms(i.frame - cutFrames) - 1e-9).reduce((n, i) => n + i.frames, 0));
  const cards: Insertion[] = [];
  // Inserts the cards of the skips that start by `until`; each lasts until `speechEnd` at least (GH-62 decision 003).
  const placeCards = (until: number, speechEnd = 0) => {
    while (cards.length < cut.length && cut[cards.length].t <= until) {
      const { frame, text } = cut[cards.length];
      const startMs = ms(frame - cutFrames - dropped(frame) + insertions.filter((i) => i.frame <= frame).reduce((n, i) => n + i.frames, 0));
      const card = { frame, frames: Math.max(Math.round(CARD_MS * fps / 1000), Math.ceil((speechEnd - startMs) * fps / 1000 - 1e-9)), card: { text } };
      cards.push(card);
      insertions.push(card);
      order();
    }
  };
  const finalSteps = steps.map((step) => {
    const frame = frameAt(step.endMs);
    if (frame <= 0 || frame > frames) throw new Error(`step ${step.index} extends beyond the capture`);
    const startMs = mapWith(step.startMs);
    placeCards(step.endMs, step.audio ? startMs + step.audio.durationMs + 200 : 0);
    // The step's picture ends at its frame, after whatever was inserted inside the step.
    const visualEnd = ms(frame - cutFrames - dropped(frame)) +
      ms(insertions.filter((i) => i.frame < frame).reduce((n, i) => n + i.frames, 0));
    const needed = step.audio ? startMs + step.audio.durationMs + 200 : visualEnd;
    const extra = Math.max(0, Math.ceil((needed - visualEnd) * fps / 1000 - 1e-9));
    const result = { ...step, startMs, actionEndMs: mapWith(step.actionEndMs), endMs: visualEnd + ms(extra) };
    if (extra) {
      insertions.push({ frame, frames: extra });
      order();
    }
    return result;
  });
  placeCards(Infinity);
  const spanOf = (insertion: Insertion) => {
    const before = insertions.slice(0, insertions.indexOf(insertion)).reduce((n, i) => n + i.frames, 0);
    const startMs = ms(insertion.frame - cutFrames - dropped(insertion.frame) + before);
    return { startMs, endMs: startMs + ms(insertion.frames) };
  };
  const imageSpans = imageInsertions.map(spanOf);
  const cardSpans = cards.map((card) => ({ ...spanOf(card), text: card.card!.text }));
  for (const s of cut) {
    if (insertions.some((i) => i.frame > s.frame && i.frame < s.frame + s.frames)) throw new Error("a skip overlaps an insertion");
  }
  const stretches = sped.map((s): Stretch => {
    if (insertions.some((i) => i.frame > s.frame && i.frame < s.frame + s.frames)) throw new Error("a speed-up overlaps an insertion");
    // Holds and images at the stretch's first frame play before it.
    const before = insertions.filter((i) => i.frame <= s.frame).reduce((n, i) => n + i.frames, 0);
    const startMs = ms(s.frame - cutFrames - dropped(s.frame) + before);
    return { ...s, startMs, endMs: startMs + ms(s.kept) };
  });
  return {
    fps, sourceFrames: frames, cutFrames,
    frames: frames + insertions.reduce((n, i) => n + i.frames, 0) - [...sped, ...cut].reduce((n, s) => n + s.frames - s.kept, 0),
    insertions, imageSpans, stretches, skips: cut.map(({ frame, frames: n }) => ({ frame, frames: n })), cardSpans,
    steps: finalSteps, mapTime: mapWith,
    mapDuration: (t, durationMs) => durationMs - ms(dropped(sourceAt(t + durationMs)) - dropped(sourceAt(t))),
  };
}

/** The events without those logged inside a skip, which nothing of is seen (GH-62 decision 004); a skip stays. */
export function dropSkipped(events: readonly ComposerEvent[]): ComposerEvent[] {
  const hidden = new Set<ComposerEvent>();
  events.forEach((skip, at) => {
    if (skip.type !== "skip") return;
    for (const e of events.slice(at + 1)) if (e.t < skip.t + skip.durationMs) hidden.add(e);
  });
  return events.filter((e) => !hidden.has(e));
}

/**
 * Each frame event moves to where its image starts in the video, and each skip to where its card starts; every other event through `mapTime`, and its
 * duration shrinks by what stretches drop inside it (GH-61 decision 003), so it lasts as long as its picture does.
 */
export function retimeEvents(events: readonly ComposerEvent[], timeline: Timeline): ComposerEvent[] {
  let image = 0;
  let card = 0;
  return events.map((event): ComposerEvent => {
    if (event.type === "frame") return { ...event, t: timeline.imageSpans[image++].startMs };
    // A skip keeps its length: the real time cut, which its card shows.
    if (event.type === "skip") return { ...event, t: timeline.cardSpans[card++].startMs };
    const t = timeline.mapTime(event.t);
    const span = (d: number) => timeline.mapDuration(event.t, d);
    switch (event.type) {
      case "move": case "scroll": case "speed": return { ...event, t, durationMs: span(event.durationMs) };
      case "flash": case "zoom": return { ...event, t, ms: span(event.ms) };
      case "type": {
        const typing = event.charDelayMs * event.text.length;
        return { ...event, t, charDelayMs: typing ? event.charDelayMs * span(typing) / typing : event.charDelayMs };
      }
      default: return { ...event, t };
    }
  });
}

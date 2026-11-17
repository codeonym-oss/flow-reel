// The video's timeline: the capture plus insertions (GH-32 decision 003). A hold repeats the frame before it, so a
// comment can finish; a card shows a card's clip. Both are placed at a capture frame, and every time on the
// capture's clock moves to the video's through one mapping, `mapTime`. A stretch (GH-61) plays a run of capture
// frames faster: output frame i of it is source frame floor(i × factor), so it keeps ceil(frames / factor) of them
// (GH-61 decisions 007 and 008). A skip (GH-62) cuts a run of capture frames and inserts a card in their place: the
// frame before them, held for at least 1.5 s or until the step's comment ends (GH-62 decision 003). A card (GH-76
// decision 002) is inserted at its frame for 3 s, or until its step's comment ends, or for exactly its `ms`; the skip
// card is a card too, drawn by the same renderer (GH-76 decision 008).
import type { ComposerEvent } from "./schema/events.ts";
import type { TranscriptStep } from "./schema/transcript.ts";

/**
 * Inserts `frames` frames before source frame `frame` (indices include calibration pre-roll): clones of frame - 1
 * for a hold, or the clip of the card `id`.
 */
export interface Insertion { frame: number; frames: number; card?: { id: string } }
/** A `speedUp` call: when it started on the capture's clock, how long it ran, and its factor. */
export interface TimelineSpeedUp { t: number; durationMs: number; factor: number }
/** A `skip` call: when it started on the capture's clock and how long it ran. */
export interface TimelineSkip { t: number; durationMs: number }
/** A `card` call: when it was made on the capture's clock, and the exact length asked for, if any. */
export interface TimelineCard { t: number; ms?: number }
/**
 * Where a card shows in the video. `id` is `card<i>` for the i-th card word and `skip<i>` for the i-th skip's card;
 * `frame` is the source frame it is inserted before (indices include calibration pre-roll).
 */
export interface CardSpan { id: string; frame: number; frames: number; startMs: number; endMs: number }
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
  /** In video order; at one frame, holds come before cards, and cards keep the order they were shown in. */
  insertions: Insertion[];
  /** In video order; none overlaps an insertion. */
  stretches: Stretch[];
  /** Source frames [frame, frame + frames) that skips cut, in source order. */
  skips: { frame: number; frames: number }[];
  /** Every card, the card words' and the skips', in video order. */
  cards: CardSpan[];
  steps: TranscriptStep[];
  /** Moves a time on the capture's clock to the video's; a time at an insertion's frame lands after it. */
  mapTime(ms: number): number;
  /** How long `durationMs` from capture time `t` lasts in the video: shorter by what stretches drop inside it. */
  mapDuration(t: number, durationMs: number): number;
}

// A skip's card shows for at least this long (GH-62 decision 003), a card word's for this long (GH-76 decision 002).
const SKIP_CARD_MS = 1500;
const CARD_MS = 3000;

export function planTimeline(
  steps: readonly TranscriptStep[],
  { fps, frames, cutMs, speedUps = [], skips = [], cards = [] }:
    { fps: number; frames: number; cutMs: number; speedUps?: readonly TimelineSpeedUp[];
      skips?: readonly TimelineSkip[]; cards?: readonly TimelineCard[] },
): Timeline {
  const cutFrames = Math.round(cutMs * fps / 1000);
  const ms = (n: number) => n * 1000 / fps;
  const frameAt = (t: number) => Math.ceil((t + ms(cutFrames)) * fps / 1000 - 1e-9);
  const sped = speedUps.map(({ t, durationMs, factor }) => {
    const frame = frameAt(t);
    const end = frameAt(t + durationMs);
    if (frame <= 0 || end > frames) throw new Error(`a speed-up at ${Math.round(t)} ms is beyond the capture`);
    return { frame, frames: end - frame, kept: Math.ceil((end - frame) / factor), factor };
  }).filter((s) => s.frames > 0);
  const cut = skips.map(({ t, durationMs }) => {
    const frame = frameAt(t);
    const end = frameAt(t + durationMs);
    if (frame <= 0 || end > frames) throw new Error(`a skip at ${Math.round(t)} ms is beyond the capture`);
    return { t, frame, frames: end - frame, kept: 0, factor: Infinity };
  });
  // The cards still to place, in the order they were shown: each skip's, and each card word's.
  const due = [
    ...cut.map(({ t, frame }, i) => ({ t, frame, id: `skip${i}`, minMs: SKIP_CARD_MS, exact: false })),
    ...cards.map(({ t, ms: exact }, i) => {
      const frame = frameAt(t);
      if (frame <= 0 || frame > frames) throw new Error(`a card shown at ${Math.round(t)} ms is beyond the capture`);
      return { t, frame, id: `card${i}`, minMs: exact ?? CARD_MS, exact: exact !== undefined };
    }),
  ].sort((a, b) => a.t - b.t);
  // Frames the stretches and skips drop before source frame `at` (fractional inside a stretch, so times inside it scale).
  const dropped = (at: number) => [...sped, ...cut].reduce((n, s) => n + (at <= s.frame ? 0 : at >= s.frame + s.frames - 1e-9
    ? s.frames - s.kept : (at - s.frame) * (1 - 1 / s.factor)), 0);
  const sourceAt = (t: number) => t * fps / 1000 + cutFrames;
  const insertions: Insertion[] = [];
  const order = () => insertions.sort((a, b) => a.frame - b.frame ||
    Number(Boolean(a.card)) - Number(Boolean(b.card)));
  const framesOf = (ms: number) => Math.max(1, Math.round(ms * fps / 1000));
  order();
  const mapWith = (t: number) => t - ms(dropped(sourceAt(t))) +
    ms(insertions.filter((i) => t >= ms(i.frame - cutFrames) - 1e-9).reduce((n, i) => n + i.frames, 0));
  const placed: Insertion[] = [];
  // Inserts the cards shown by `until`; unless its length is exact, each lasts until `speechEnd` at least (GH-62
  // decision 003, GH-76 decision 002).
  const placeCards = (until: number, speechEnd = 0) => {
    while (placed.length < due.length && due[placed.length].t <= until) {
      const { frame, id, minMs, exact } = due[placed.length];
      const startMs = ms(frame - cutFrames - dropped(frame) + insertions.filter((i) => i.frame <= frame).reduce((n, i) => n + i.frames, 0));
      const card = { frame, frames: exact ? framesOf(minMs) : Math.max(framesOf(minMs), Math.ceil((speechEnd - startMs) * fps / 1000 - 1e-9)), card: { id } };
      placed.push(card);
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
  const cardSpans = placed.map((card): CardSpan => ({ id: card.card!.id, frame: card.frame, frames: card.frames, ...spanOf(card) }))
    .sort((a, b) => a.startMs - b.startMs);
  for (const s of cut) {
    if (insertions.some((i) => i.frame > s.frame && i.frame < s.frame + s.frames)) throw new Error("a skip overlaps an insertion");
  }
  const stretches = sped.map((s): Stretch => {
    if (insertions.some((i) => i.frame > s.frame && i.frame < s.frame + s.frames)) throw new Error("a speed-up overlaps an insertion");
    // Holds and cards at the stretch's first frame play before it.
    const before = insertions.filter((i) => i.frame <= s.frame).reduce((n, i) => n + i.frames, 0);
    const startMs = ms(s.frame - cutFrames - dropped(s.frame) + before);
    return { ...s, startMs, endMs: startMs + ms(s.kept) };
  });
  return {
    fps, sourceFrames: frames, cutFrames,
    frames: frames + insertions.reduce((n, i) => n + i.frames, 0) - [...sped, ...cut].reduce((n, s) => n + s.frames - s.kept, 0),
    insertions, stretches, skips: cut.map(({ frame, frames: n }) => ({ frame, frames: n })), cards: cardSpans,
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
 * Each skip and card event moves to where its card starts in the video; every other event through `mapTime`, and its
 * duration shrinks by what stretches drop inside it (GH-61 decision 003), so it lasts as long as its picture does.
 */
export function retimeEvents(events: readonly ComposerEvent[], timeline: Timeline): ComposerEvent[] {
  let skip = 0;
  let card = 0;
  const start = (id: string) => timeline.cards.find((c) => c.id === id)!.startMs;
  return events.map((event): ComposerEvent => {
    // A skip keeps its length: the real time cut, which its card shows.
    if (event.type === "skip") return { ...event, t: start(`skip${skip++}`) };
    if (event.type === "card") return { ...event, t: start(`card${card++}`) };
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

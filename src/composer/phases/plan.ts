// The third phase: turns the cue sheet and the voice's clips into the video's timeline, the cards to draw and the reel's
// event log. Pure: the same inputs give the same plan.
import { type Brand, themeFor } from "../cards/brand.ts";
import type { CardJob } from "../cards/job.ts";
import type { CueSheet } from "../schema/cues.ts";
import { type EventLog, validateEvents } from "../schema/events.ts";
import type { Plan } from "../schema/plan.ts";
import type { TranscriptStep } from "../schema/transcript.ts";
import type { Voiced } from "../schema/voiced.ts";
import { dropSkipped, planTimeline, retimeEvents } from "../timeline.ts";

export function planReel(cues: CueSheet, voiced: Voiced, { brand, sound }: { brand: Brand; sound: boolean }): Plan {
  const { events, fps, viewport, autoZoom } = cues;
  const clips = new Map(voiced.clips.map(({ step, audio }) => [step, audio]));
  const steps = cues.steps.map((step): TranscriptStep => {
    const audio = clips.get(step.index);
    return audio ? { ...step, audio } : step;
  });
  const speedUps = events.flatMap((e) => e.type === "speed" ? [{ t: e.t, durationMs: e.durationMs, factor: e.factor }] : []);
  // Nothing inside a skip is seen, so its events go (GH-62 decision 004).
  const seen = dropSkipped(events);
  const skips = seen.flatMap((e) => e.type === "skip" ? [e] : []);
  const cards = seen.flatMap((e) => e.type === "card" ? [e] : []);
  const { mapTime, mapDuration, ...timeline } = planTimeline(steps, { fps, frames: cues.capture.frames, cutMs: cues.capture.cutMs, speedUps,
    skips: skips.map(({ t, durationMs }) => ({ t, durationMs })), cards: cards.map(({ t, ms }) => ({ t, ms })) });
  const log: EventLog = { version: 6, autoZoom, events: retimeEvents(seen, { ...timeline, mapTime, mapDuration }) };
  const errors = validateEvents(log);
  if (errors.length) throw new Error(`recording events are invalid:\n  ${errors.join("\n  ")}`);
  // Chapters are numbered once the script has run (GH-76 decision 002).
  const chapters = cards.filter((e) => e.card === "chapter");
  const jobs = timeline.cards.map(({ id, frame, frames }): CardJob => {
    const index = Number(id.replace(/^\D+/, ""));
    if (id.startsWith("skip")) {
      const skip = skips[index];
      return { id, kind: "skip", props: { label: skip.label, style: skip.style, durationMs: skip.durationMs },
        theme: themeFor(brand.theme ?? "ink", brand), enter: "fade", exit: "fade", frame, frames };
    }
    const card = cards[index];
    const number = chapters.indexOf(card) + 1;
    return { id, kind: card.card, props: card.props, ...(card.card === "custom" ? { page: card.files[0].path } : {}),
      theme: themeFor(card.theme, brand), enter: card.enter, exit: card.exit, frame, frames,
      ...(number ? { chapter: { number, total: chapters.length } } : {}) };
  });
  return { version: 1, viewport, fps, sound, timeline, cards: jobs, log };
}

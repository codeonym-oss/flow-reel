// The fourth phase: draws the plan's cards and overlays and encodes the video. It runs in the composer's container,
// without the network.
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Brand } from "../cards/brand.ts";
import { renderCards } from "../media/cards.ts";
import { renderOverlays } from "../media/overlays.ts";
import { durationMs } from "../media/recording.ts";
import { renderTimeline } from "../media/render.ts";
import type { CardPainter } from "../ports.ts";
import type { Report } from "../progress.ts";
import { RENDERED_FILE, VIDEO_FILE } from "../schema/files.ts";
import type { Plan } from "../schema/plan.ts";
import type { Rendered } from "../schema/rendered.ts";

export interface RenderJob {
  plan: Plan;
  capture: string;
  /** The folder the clips' paths (`audio/000.wav`) are relative to. */
  audioRoot: string;
  scriptsDir: string;
  brand: Brand;
  /** Where the video and render.json go; intermediates are removed from it. */
  out: string;
}

export async function render({ plan, capture, audioRoot, scriptsDir, brand, out }: RenderJob, painter: CardPainter, report: Report): Promise<void> {
  const { viewport, fps, timeline, log } = plan;
  const work = join(out, "work");
  mkdirSync(work);
  const drawing = { work, scriptsDir, viewport, fps, brand, painter };
  if (plan.cards.length) report({ type: "drawing", what: "cards" });
  const clips = await renderCards(plan.cards, { capture, ...drawing });
  const shown = log.events.flatMap((e) => e.type === "overlay" ? [e] : []);
  if (shown.length) report({ type: "drawing", what: "overlays" });
  const overlays = await renderOverlays(shown, drawing);
  report({ type: "drawing", what: "picture" });
  const video = join(work, VIDEO_FILE);
  renderTimeline({ capture, video, voice: join(work, "voice.wav"), audioDir: audioRoot, viewport, timeline, clips, overlays,
    events: log.events, sound: plan.sound, autoZoom: log.autoZoom });
  const rendered: Rendered = { version: 1, durationMs: durationMs(video) };
  writeFileSync(join(out, RENDERED_FILE), `${JSON.stringify(rendered, null, 2)}\n`);
  renameSync(video, join(out, VIDEO_FILE));
  rmSync(work, { recursive: true });
}

// Draws overlays (GH-76 decision 007): each is painted on a transparent page at its layer's size, only its frames
// that move (the way in and the way out) and one still between them, which the frames held in between link to.
import { linkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Brand, themeFor } from "../cards/brand.ts";
import { LAYER, OVERLAY_IN_MS, OVERLAY_OUT_MS, overlayBody } from "../cards/overlays.ts";
import { ORIGIN, builtInPage, scriptUrl } from "../cards/page.ts";
import type { CardPainter } from "../ports.ts";
import type { OverlayEvent } from "../schema/events.ts";
import { SCALE } from "./display.ts";
import { fileFor } from "./cards.ts";

/** An overlay drawn as numbered PNG frames with transparency, to lay over the video from `startMs`. */
export interface DrawnOverlay { pattern: string; startMs: number; frames: number; layer: "app" | "screen" }

const name = (i: number) => `${String(i).padStart(5, "0")}.png`;

/** Draws the overlays of a retimed event log; their `t` and `durationMs` are on the video's clock. */
export async function renderOverlays(events: readonly OverlayEvent[], options:
  { work: string; scriptsDir: string; viewport: [number, number]; fps: number; brand: Brand; painter: CardPainter }): Promise<DrawnOverlay[]> {
  const shown = events.filter((e) => e.durationMs > 0);
  if (!shown.length) return [];
  const { work, scriptsDir, viewport, fps, brand, painter } = options;
  const canvas = await painter.open();
  try {
    const drawn: DrawnOverlay[] = [];
    for (const [index, event] of shown.entries()) {
      const dir = join(work, `overlay${index}`);
      mkdirSync(dir, { recursive: true });
      const frames = Math.max(1, Math.round(event.durationMs * fps / 1000));
      const durationMs = frames * 1000 / fps;
      const into = Math.ceil(OVERLAY_IN_MS * fps / 1000) + 1;
      const out = Math.ceil(OVERLAY_OUT_MS * fps / 1000) + 1;
      // Frames to paint: all of them for a short overlay; else the way in, one still, and the way out.
      const painted = frames <= into + out + 1 ? Array.from({ length: frames }, (_, i) => i)
        : [...Array.from({ length: into + 1 }, (_, i) => i), ...Array.from({ length: out }, (_, i) => frames - out + i)];
      const html = builtInPage({ theme: themeFor(event.theme, brand), props: event.props, durationMs,
        fonts: { ...(brand.fonts?.heading ? { heading: scriptUrl(brand.fonts.heading) } : {}), ...(brand.fonts?.body ? { body: scriptUrl(brand.fonts.body) } : {}) } },
      overlayBody(event.overlay, event.props, viewport, event.bounds));
      const layer = LAYER[event.overlay];
      await canvas.paint({ url: `${ORIGIN}/overlay.html`, html, file: (path) => fileFor(path, "", scriptsDir), viewport,
        scale: layer === "app" ? SCALE : 1, transparent: true, times: painted.map((i) => i * 1000 / fps), frame: (i) => join(dir, name(painted[i])) });
      for (let i = into + 1; i < frames - out; i++) linkSync(join(dir, name(into)), join(dir, name(i)));
      drawn.push({ pattern: join(dir, "%05d.png"), startMs: event.t, frames, layer });
    }
    return drawn;
  } finally {
    await canvas.close();
  }
}

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Curve, planPolish, type PolishOptions } from "../polish.ts";
import type { ComposerEvent } from "../schema/events.ts";
import { FONTS_DIR as fonts } from "./fonts.ts";

// Same cubic curves as the pure planner, evaluated by FFmpeg on the delivery frame clock.
function expression(curve: Curve, clock: string, initial: number): string {
  if (!curve.length) return String(initial);
  const terms = [`${initial}*lt(${clock},${curve[0].start})`];
  for (const [i, s] of curve.entries()) {
    const progress = `clip((${clock}-${s.start})/${s.end - s.start || 1},0,1)`;
    const k = s.end === s.start ? "1" : `if(lt(${progress},0.5),4*pow(${progress},3),1-pow(-2*${progress}+2,3)/2)`;
    const value = s.to === s.from ? String(s.to) : `${s.from}+(${s.to - s.from})*(${k})`;
    terms.push(`gte(${clock},${s.start})*${i + 1 < curve.length ? `lt(${clock},${curve[i + 1].start})*` : ""}(${value})`);
  }
  return terms.join("+");
}

function cursor(file: string): void {
  const size = 28;
  const pixels = Buffer.alloc(size * size * 4);
  // Owned arrow geometry, including a two-pixel dark outline. No platform fonts or image decoders.
  const polygon = [[1, 1], [1, 22], [7, 17], [11, 25], [15, 23], [11, 15], [20, 15]];
  const inside = (x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
    }
    return hit;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => !inside(x + 0.5 + dx * 1.5, y + 0.5 + dy * 1.5));
    const at = (y * size + x) * 4;
    pixels.set([edge ? 25 : 255, edge ? 25 : 255, edge ? 25 : 255, 255], at);
  }
  writeFileSync(file, Buffer.concat([Buffer.from(`P7\nWIDTH ${size}\nHEIGHT ${size}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`), pixels]));
}

// The bundled fonts (GH-61 decision 002): Noto Sans Bold for the words, Noto Sans Symbols 2 for the arrows.
// Advance widths in em, from the fonts' hmtx tables, so the box fits its text without measuring at render time.
const ARROWS_EM = 2 * 0.799;
const textEm = (text: string) => [...text].reduce((n, c) => n + (c === "." ? 0.281 : 0.572), 0);
const BADGE_FADE_MS = 200;

/**
 * The speed-up badge (GH-61 decision 006): "▶▶ ×N" in white, 4 % of the video's height, on a dark, slightly
 * see-through rounded box 3 % of the height from the top-right corner. Writes the box image; returns where things go.
 */
function badge(file: string, factor: number, [width, height]: [number, number]) {
  const size = Math.max(8, Math.round(height * 0.04));
  const label = `×${factor}`;
  const pad = Math.round(size * 0.45), gap = Math.round(size * 0.25);
  const boxWidth = 2 * pad + Math.ceil(size * (ARROWS_EM + textEm(label))) + gap;
  const boxHeight = Math.round(size * 1.5);
  const radius = boxHeight * 0.3;
  const pixels = Buffer.alloc(boxWidth * boxHeight * 4);
  for (let y = 0; y < boxHeight; y++) for (let x = 0; x < boxWidth; x++) {
    // Distance outside the rounded rectangle, antialiased over one pixel.
    const dx = Math.max(radius - (x + 0.5), x + 0.5 - (boxWidth - radius), 0);
    const dy = Math.max(radius - (y + 0.5), y + 0.5 - (boxHeight - radius), 0);
    const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(dx, dy)));
    pixels.set([16, 16, 16, Math.round(coverage * 0.65 * 255)], (y * boxWidth + x) * 4);
  }
  writeFileSync(file, Buffer.concat([Buffer.from(`P7\nWIDTH ${boxWidth}\nHEIGHT ${boxHeight}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`), pixels]));
  const margin = Math.round(height * 0.03);
  const x = width - margin - boxWidth;
  // drawtext's y is the top of the drawn glyphs, so each text is centred on the box by its own height.
  const textY = `${margin + boxHeight / 2}-th/2`;
  return { x, y: margin, size, label, arrowsX: x + pad, labelX: x + pad + Math.round(size * ARROWS_EM) + gap, textY };
}

export function polishFilters(events: readonly ComposerEvent[], options: PolishOptions, video: string, firstInput: number) {
  const plan = planPolish(events, options);
  const [width, height] = options.viewport;
  const work = dirname(video);
  const arrow = join(work, "cursor.pam");
  cursor(arrow);
  const stretches = options.stretches ?? [];
  const inputs = ["-loop", "1", "-framerate", String(options.fps), "-i", arrow];
  const boundedExpression = (c: Curve, clock: string, initial: number, start: number, end: number) => {
    const first = Math.max(0, c.findLastIndex((s) => s.start <= start));
    return expression(c.slice(first).filter((s) => s.start <= end), clock, initial);
  };
  // Over a card the crop is full and nothing is drawn (GH-32 decision 003, GH-76 decision 002).
  const inCard = (clock: string) => plan.cardSpans.length
    ? `(${plan.cardSpans.map((s) => `gte(${clock},${s.startMs - 0.5})*lt(${clock},${s.endMs - 0.5})`).join("+")})` : "";
  const positions = (clock: string, start = 0, end = Infinity) => {
    const crop = plan.camera.map((c, i) => boundedExpression(c, clock, i === 2 ? 1 : 0, start, end));
    const pointer = plan.pointer.map((c) => `clip(${boundedExpression(c, clock, 0.5, start, end)},0,1)`);
    for (let axis = 0; axis < 2; axis++) {
      const pixels = axis === 0 ? width : height;
      crop[axis] = `clip(${crop[axis]},clip((${pointer[axis]})-(${crop[2]})+24*(${crop[2]})/${pixels},0,1-(${crop[2]})),` +
        `clip((${pointer[axis]})-(${crop[2]})/${pixels},0,1-(${crop[2]})))`;
    }
    const masked = inCard(clock);
    if (masked) crop.forEach((c, i) => { crop[i] = `if(${masked},${i === 2 ? 1 : 0},${c})`; });
    return { crop, pointer };
  };
  const camera = positions(`on*1000/${options.fps}`).crop;
  const { crop, pointer } = positions("t*1000");
  const visible = plan.cardSpans.length ? `*not(${inCard("t*1000")})` : "";
  const filters = [`[trimmed]zoompan=z='1/(${camera[2]})':x='(${camera[0]})*iw':y='(${camera[1]})*ih':d=1:s=${width}x${height}:fps=${options.fps}[camera]`];
  let previous = "camera";
  if (plan.clicks.length) {
    const ringFile = join(work, "ripple.rgba");
    const count = Math.ceil(0.4 * options.fps);
    const ring = Buffer.alloc(count * 64 * 64 * 4);
    for (let f = 0; f < count; f++) {
      const k = f / (0.4 * options.fps), radius = 8 + 20 * k;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const alpha = Math.max(0, 1 - Math.abs(Math.hypot(x - 32, y - 32) - radius) / 1.5) * (1 - k);
        ring.set([40, 140, 255, Math.round(alpha * 255)], ((f * 64 + y) * 64 + x) * 4);
      }
    }
    writeFileSync(ringFile, ring);
    inputs.push("-f", "rawvideo", "-pixel_format", "rgba", "-video_size", "64x64", "-framerate", String(options.fps), "-i", ringFile);
    filters.push(`[${firstInput + 1}:v]split=${plan.clicks.length}${plan.clicks.map((_, i) => `[r${i}]`).join("")}`);
    plan.clicks.forEach((event, i) => {
      const { crop } = positions("t*1000", event.t, event.t + 400);
      // Align to the first delivery frame at or after the event, rather than nearest-time rounding.
      const startFrame = Math.ceil(event.t * options.fps / 1000 - 1e-9);
      const start = startFrame / options.fps;
      filters.push(`[r${i}]setpts=PTS+${start}/TB[ring${i}]`);
      // FFmpeg's rational frame time can fall just below start; compare in frame units with the planner's tolerance.
      filters.push(`[${previous}][ring${i}]overlay=x='(${event.at[0] / width}-(${crop[0]}))*${width}/(${crop[2]})-32':` +
        `y='(${event.at[1] / height}-(${crop[1]}))*${height}/(${crop[2]})-32':eof_action=pass:repeatlast=0:enable='gte(t*${options.fps},${startFrame}-1e-9)${visible}'[click${i}]`);
      previous = `click${i}`;
    });
  }
  const flashes = events.filter((e) => e.type === "flash" && e.t >= 0 && e.t < options.frames * 1000 / options.fps);
  filters.push(`[${previous}][${firstInput}:v]overlay=x='(${pointer[0]}-(${crop[0]}))*${width}/(${crop[2]})-1':` +
    `y='(${pointer[1]}-(${crop[1]}))*${height}/(${crop[2]})-1':shortest=1${visible ? `:enable='1${visible}'` : ""}` +
    `[${flashes.length || stretches.length ? "cursor" : "polished"}]`);
  previous = "cursor";
  // A flash is a full-frame colour whose opacity fades from 1 to 0, drawn over everything (GH-32 decision 002).
  flashes.forEach((event, i) => {
    if (event.type !== "flash") return;
    const input = firstInput + 1 + (plan.clicks.length ? 1 : 0) + i;
    inputs.push("-f", "lavfi", "-i", `color=c=0x${event.color.slice(1)}:s=${width}x${height}:r=${options.fps}:d=${event.ms / 1000}`);
    const startFrame = Math.ceil(event.t * options.fps / 1000 - 1e-9);
    const out = i + 1 < flashes.length || stretches.length ? `flash${i}` : "polished";
    filters.push(`[${input}:v]format=rgba,fade=t=out:st=0:d=${event.ms / 1000}:alpha=1,setpts=PTS+${startFrame / options.fps}/TB[f${i}]`);
    filters.push(`[${previous}][f${i}]overlay=eof_action=pass:repeatlast=0:enable='gte(t*${options.fps},${startFrame}-1e-9)'[${out}]`);
    previous = out;
  });
  // Last, so zoom never scales the badge and a flash never covers it. It fades in and out over 200 ms inside the
  // stretch, less when the stretch is shorter (GH-61 decision 006).
  stretches.forEach((stretch, i) => {
    const input = firstInput + 1 + (plan.clicks.length ? 1 : 0) + flashes.length + i;
    const box = join(work, `badge${i}.pam`);
    const b = badge(box, stretch.factor, [width, height]);
    inputs.push("-loop", "1", "-framerate", String(options.fps), "-i", box);
    const start = Math.round(stretch.startMs * options.fps / 1000) / options.fps;
    const end = Math.round(stretch.endMs * options.fps / 1000) / options.fps;
    const fade = Math.min(BADGE_FADE_MS / 1000, (end - start) / 2);
    const out = i + 1 < stretches.length ? `badge${i}` : "polished";
    filters.push(`[${input}:v]format=rgba,trim=duration=${end - start},fade=t=in:st=0:d=${fade}:alpha=1,` +
      `fade=t=out:st=${end - start - fade}:d=${fade}:alpha=1,setpts=PTS+${start}/TB[box${i}]`);
    const alpha = `'min(1,min((t-${start})/${fade},(${end}-t)/${fade}))'`;
    const text = (font: string, value: string, x: number) => `drawtext=fontfile='${join(fonts, font)}':text='${value}':` +
      `fontsize=${b.size}:fontcolor=white:x=${x}:y='${b.textY}':alpha=${alpha}:enable='between(t,${start},${end})'`;
    filters.push(`[${previous}][box${i}]overlay=x=${b.x}:y=${b.y}:eof_action=pass:repeatlast=0,` +
      `${text("NotoSansSymbols2-Regular.ttf", "▶▶", b.arrowsX)},${text("NotoSans-Bold.ttf", b.label, b.labelX)}[${out}]`);
    previous = out;
  });
  return { inputs, filters: filters.join(";") };
}

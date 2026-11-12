import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Curve, planPolish, type PolishOptions } from "./polish.ts";
import type { RunnerEvent } from "../schema/events.ts";

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

export function polishFilters(events: readonly RunnerEvent[], options: PolishOptions, video: string, firstInput: number) {
  const plan = planPolish(events, options);
  const [width, height] = options.viewport;
  const work = dirname(video);
  const arrow = join(work, "cursor.pam");
  cursor(arrow);
  const inputs = ["-loop", "1", "-framerate", String(options.fps), "-i", arrow];
  const boundedExpression = (c: Curve, clock: string, initial: number, start: number, end: number) => {
    const first = Math.max(0, c.findLastIndex((s) => s.start <= start));
    return expression(c.slice(first).filter((s) => s.start <= end), clock, initial);
  };
  const positions = (clock: string, start = 0, end = Infinity) => {
    const crop = plan.camera.map((c, i) => boundedExpression(c, clock, i === 2 ? 1 : 0, start, end));
    const pointer = plan.pointer.map((c) => `clip(${boundedExpression(c, clock, 0.5, start, end)},0,1)`);
    for (let axis = 0; axis < 2; axis++) {
      const pixels = axis === 0 ? width : height;
      crop[axis] = `clip(${crop[axis]},clip((${pointer[axis]})-(${crop[2]})+24*(${crop[2]})/${pixels},0,1-(${crop[2]})),` +
        `clip((${pointer[axis]})-(${crop[2]})/${pixels},0,1-(${crop[2]})))`;
    }
    return { crop, pointer };
  };
  const camera = positions(`on*1000/${options.fps}`).crop;
  const { crop, pointer } = positions("t*1000");
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
        `y='(${event.at[1] / height}-(${crop[1]}))*${height}/(${crop[2]})-32':eof_action=pass:repeatlast=0:enable='gte(t*${options.fps},${startFrame}-1e-9)'[click${i}]`);
      previous = `click${i}`;
    });
  }
  filters.push(`[${previous}][${firstInput}:v]overlay=x='(${pointer[0]}-(${crop[0]}))*${width}/(${crop[2]})-1':` +
    `y='(${pointer[1]}-(${crop[1]}))*${height}/(${crop[2]})-1':shortest=1[polished]`);
  return { inputs, filters: filters.join(";") };
}

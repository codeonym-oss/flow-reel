import type { Bounds, Point, RunnerEvent } from "../schema/events.ts";
import { easeInOutCubic } from "./easing.ts";
import { SAME_CLICK_MS } from "./sfx.ts";

export interface CurveSpan { start: number; end: number; from: number; to: number }
export type Curve = CurveSpan[];
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function curveAt(curve: Curve, t: number, initial: number): number {
  let value = initial;
  for (const s of curve) {
    if (t < s.start) break;
    const k = s.end === s.start ? 1 : easeInOutCubic(clamp((t - s.start) / (s.end - s.start), 0, 1));
    value = s.from + (s.to - s.from) * k;
  }
  return value;
}

export interface PolishOptions { viewport: [number, number]; source: [number, number]; fps: number; frames: number }
const ZOOM_IN_MS = 650;
const ZOOM_IDLE_MS = 2000;
const ZOOM_OUT_MS = 800;

/** Camera crops are normalized [left, top, width share]; all crops retain the viewport aspect ratio. */
export function planPolish(events: readonly RunnerEvent[], options: PolishOptions) {
  const { viewport: [width, height], source: [sw, sh], fps, frames } = options;
  const minShare = 1 / Math.max(1, Math.min(4 / 3, sw / width, sh / height));
  const camera: [Curve, Curve, Curve] = [[], [], []];
  const pointer: [Curve, Curve] = [[], []];
  const initial = [0, 0, 1];
  const value = (curves: Curve[], t: number, defaults: number[]) => curves.map((c, i) => curveAt(c, t, defaults[i]));
  const change = (curves: Curve[], t: number, duration: number, to: number[], defaults: number[]) => {
    const from = value(curves, t, defaults);
    curves.forEach((c, i) => {
      while (c.length && c.at(-1)!.start >= t) c.pop();
      c.push({ start: t, end: t + duration, from: from[i], to: to[i] });
    });
  };
  const fit = (at: Point, bounds?: Bounds): number[] => {
    const left = bounds ? clamp(bounds.x - 24, 0, width) / width : clamp(at[0] / width, 0, 1);
    const right = bounds ? clamp(bounds.x + bounds.width + 24, 0, width) / width : left;
    const top = bounds ? clamp(bounds.y - 24, 0, height) / height : clamp(at[1] / height, 0, 1);
    const bottom = bounds ? clamp(bounds.y + bounds.height + 24, 0, height) / height : top;
    const share = Math.max(minShare, right - left, bottom - top);
    return [clamp(at[0] / width - share / 2, Math.max(0, right - share), Math.min(left, 1 - share)),
      clamp(at[1] / height - share / 2, Math.max(0, bottom - share), Math.min(top, 1 - share)), share];
  };
  let deadline = -Infinity;
  let target = [0, 0, 1];
  let cameraTarget = target;
  const sorted = events.filter((e) => e.type !== "sfx").sort((a, b) => a.t - b.t);
  sorted.forEach((event, i) => {
    const previousDeadline = deadline;
    if (event.type === "move") {
      if (event.easing !== "easeInOutCubic") throw new Error(`unsupported pointer easing: ${event.easing}`);
      // A logged move includes its actual starting point, including older standalone logs.
      change(pointer, event.t, 0, [event.from[0] / width, event.from[1] / height], [0.5, 0.5]);
      change(pointer, event.t, event.durationMs, [event.to[0] / width, event.to[1] / height], [event.from[0] / width, event.from[1] / height]);
      // Anticipate the approached target so it is already framed when its click lands.
      const next = sorted[i + 1];
      target = fit(event.to, next?.type === "click" ? next.bounds : undefined);
    } else if (event.type === "click") {
      change(pointer, event.t, 0, [event.at[0] / width, event.at[1] / height], [0.5, 0.5]);
      deadline = Math.max(deadline, event.t + ZOOM_IDLE_MS);
      target = fit(event.at, event.bounds);
    } else if (event.type === "type" && event.t <= deadline + ZOOM_OUT_MS) {
      deadline = Math.max(deadline, event.t + event.text.length * event.charDelayMs + ZOOM_IDLE_MS);
      const at = value(pointer, event.t, [0.5, 0.5]);
      target = fit([at[0] * width, at[1] * height], event.bounds);
    } else return;
    if (event.t > deadline + ZOOM_OUT_MS) return;
    // Hover does not restart an already-ending zoom or move its return-to-full deadline.
    if (event.type === "move" && event.t >= deadline) return;
    const sameTarget = target.every((v, axis) => Math.abs(v - cameraTarget[axis]) < 1e-12);
    if (event.t < previousDeadline && sameTarget) {
      // Typing/repeated clicks at this target extend the hold without resetting an in-flight ease.
      camera.forEach((c) => { if (c.at(-1)?.start === previousDeadline) c.pop(); });
    } else change(camera, event.t, event.type === "move" ? event.durationMs : ZOOM_IN_MS, target, initial);
    cameraTarget = target;
    // An event during ease-out restarts from the current crop, rather than snapping to full zoom.
    const from = value(camera, deadline, initial);
    camera.forEach((c, axis) => c.push({ start: deadline, end: deadline + ZOOM_OUT_MS, from: from[axis], to: initial[axis] }));
  });
  // A double-click's two presses share one ripple rather than doubling its opacity.
  const clicks = sorted.filter((e) => e.type === "click")
    .filter((e, i, all) => i === 0 || e.t - all[i - 1].t > SAME_CLICK_MS);
  return { frames, fps, camera, pointer, clicks, frame(n: number) {
    const t = n * 1000 / fps;
    const crop = value(camera, t, initial);
    const at = value(pointer, t, [0.5, 0.5]);
    // Include the sprite, not only its hotspot, when a move outruns the camera during ease-out.
    for (let axis = 0; axis < 2; axis++) {
      at[axis] = clamp(at[axis], 0, 1);
      const pixels = axis === 0 ? width : height;
      crop[axis] = clamp(crop[axis], clamp(at[axis] - crop[2] + 24 * crop[2] / pixels, 0, 1 - crop[2]),
        clamp(at[axis] - crop[2] / pixels, 0, 1 - crop[2]));
    }
    return { crop, zoom: 1 / crop[2], cursor: [(at[0] - crop[0]) * width / crop[2], (at[1] - crop[1]) * height / crop[2]],
      ripples: clicks.filter((e) => t >= e.t && t < e.t + 400).map((e) => ({
        x: (e.at[0] / width - crop[0]) * width / crop[2], y: (e.at[1] / height - crop[1]) * height / crop[2],
        radius: 8 + 20 * (t - e.t) / 400, opacity: 1 - (t - e.t) / 400,
      })) };
  } };
}

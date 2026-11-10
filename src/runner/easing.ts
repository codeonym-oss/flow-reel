// How the runner moves the mouse: eased paths whose duration grows with distance (GH-2 decision 002).
import type { Point } from "../schema/events.ts";

const MIN_MS = 300;
const MAX_MS = 700;
const FULL_DIAGONAL = Math.hypot(1920, 1080);

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function moveDuration(from: Point, to: Point): number {
  const share = Math.min(1, Math.hypot(to[0] - from[0], to[1] - from[1]) / FULL_DIAGONAL);
  return Math.round(MIN_MS + (MAX_MS - MIN_MS) * share);
}

/** The positions to visit, one per frame, the last one exactly on `to`. */
export function pathPoints(from: Point, to: Point, durationMs: number, fps: number): Point[] {
  const frames = Math.max(1, Math.round((durationMs / 1000) * fps));
  return Array.from({ length: frames }, (_, i) => {
    const k = easeInOutCubic((i + 1) / frames);
    return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
  });
}

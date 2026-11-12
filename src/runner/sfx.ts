import { SFX_NAMES, type RunnerEvent } from "../schema/events.ts";
import type { Sfx } from "../index.ts";

export type SoundAsset = "click" | "typing0" | "typing1" | "typing2" | Parameters<Sfx>[0];
export interface SoundPlacement { sample: number; asset: SoundAsset }
export const SAMPLE_RATE = 48000;

/** Mark an explicit sound without advancing the recording clock. */
export function cueLogger(clock: { now(): number }, events: RunnerEvent[]): Sfx {
  return (name) => {
    if (!SFX_NAMES.includes(name)) throw new Error(`unknown sound cue: ${String(name)}`);
    events.push({ t: clock.now(), type: "sfx", name });
  };
}

/** Positions are already calibrated and held: never retime them a second time. */
export function planSfx(events: readonly RunnerEvent[], durationMs: number): SoundPlacement[] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const cues = sorted.filter((e) => e.type === "sfx" && e.t >= 0 && e.t < durationMs);
  const placed: SoundPlacement[] = [];
  let typing = 0;
  const add = (t: number, asset: SoundAsset) => {
    const sample = Math.round(t * 48);
    if (t >= 0 && sample < Math.round(durationMs * 48)) placed.push({ sample, asset });
  };
  for (const event of sorted) {
    if (event.type === "click" && !cues.some((c) => Math.abs(c.t - event.t) <= 150)) add(event.t, "click");
    else if (event.type === "sfx") add(event.t, event.name);
    else if (event.type === "type") {
      let i = 0;
      for (const char of event.text) {
        // Playwright presses US-layout keys immediately, but waits before insertText for other code points.
        const inserted = !/^[\x20-\x7e\r\n]$/.test(char);
        add(event.t + (i++ + Number(inserted)) * event.charDelayMs, `typing${typing++ % 3}` as SoundAsset);
      }
    }
  }
  return placed.sort((a, b) => a.sample - b.sample);
}

import { SOUND_NAMES, type ComposerEvent, type Sound, type SoundName } from "./schema/events.ts";

export type SoundAsset = "click" | "typing0" | "typing1" | "typing2" | SoundName;
export interface SoundPlacement { sample: number; asset: SoundAsset }
export const SAMPLE_RATE = 48000;
/** Clicks this close together are one gesture's presses (a double-click), rendered as one sound and one ripple. */
export const SAME_CLICK_MS = 30;

/** Throws unless `sound` is one of the `Sounds` constants; a script in plain JavaScript has no types to catch it. */
export function checkSound(sound: unknown): asserts sound is Sound {
  if (!SOUND_NAMES.includes(sound as SoundName)) {
    throw new Error(`unknown sound ${JSON.stringify(sound)}: use one of the Sounds constants from "flow-reel"`);
  }
}

/** Logs a script's sound at this moment, without advancing the recording clock. */
export function soundLogger(clock: { now(): number }, events: ComposerEvent[]): (sound: Sound) => void {
  return (sound) => {
    checkSound(sound);
    events.push({ t: clock.now(), type: "sound", name: sound });
  };
}

/** Positions are already calibrated and held: never retime them a second time. */
export function planSfx(events: readonly ComposerEvent[], durationMs: number): SoundPlacement[] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const cues = sorted.filter((e) => e.type === "sound" && e.t >= 0 && e.t < durationMs);
  const placed: SoundPlacement[] = [];
  let typing = 0;
  let lastClick = -Infinity;
  const add = (t: number, asset: SoundAsset) => {
    const sample = Math.round(t * 48);
    if (t >= 0 && sample < Math.round(durationMs * 48)) placed.push({ sample, asset });
  };
  for (const event of sorted) {
    if (event.type === "click") {
      // A double-click logs two presses at one moment: one click sound, not two stacked into a louder one.
      if (event.t - lastClick > SAME_CLICK_MS && !cues.some((c) => Math.abs(c.t - event.t) <= 150)) {
        add(event.t, "click");
        lastClick = event.t;
      }
    } else if (event.type === "sound") add(event.t, event.name);
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

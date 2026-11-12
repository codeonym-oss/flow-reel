import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunnerEvent } from "../schema/events.ts";
import type { Timeline } from "./timeline.ts";
import { planSfx, SAMPLE_RATE, type SoundAsset } from "./sfx.ts";

const assets = fileURLToPath(new URL("../../docker/sfx/", import.meta.url));
const amplitude = (db: number) => 10 ** (db / 20);

function decode(file: string): Float32Array {
  try {
    const raw = execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-i", file, "-af", "pan=mono|c0<FL+FR+FC", "-ar", String(SAMPLE_RATE),
      "-f", "f32le", "-"], { maxBuffer: 512 << 20 });
    return Float32Array.from({ length: raw.length / 4 }, (_, i) => raw.readFloatLE(i * 4));
  } catch (error) { throw new Error(`decoding sound audio failed (${file}): ${(error as Error).message}`); }
}

function rms(pcm: Float32Array): number {
  let energy = 0;
  for (const value of pcm) energy += value * value;
  return Math.sqrt(energy / pcm.length);
}

function reference(pcm?: Float32Array): number {
  if (!pcm) return amplitude(-20);
  let energy = 0, samples = 0;
  for (let i = 0; i < pcm.length; i += 4800) {
    const window = pcm.subarray(i, i + 4800);
    const level = rms(window);
    if (level <= amplitude(-50)) continue;
    energy += level * level * window.length;
    samples += window.length;
  }
  if (!samples) throw new Error("voice has no measurable audio signal for SFX calibration");
  return Math.sqrt(energy / samples);
}

/** Fixed-length, dual-mono IEEE float WAV. FFmpeg handles final AAC/PCM conversion. */
function writeStereo(file: string, pcm: Float32Array): void {
  const data = Buffer.alloc(44 + pcm.length * 8);
  data.write("RIFF", 0); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(3, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SAMPLE_RATE, 24); data.writeUInt32LE(SAMPLE_RATE * 8, 28);
  data.writeUInt16LE(8, 32); data.writeUInt16LE(32, 34); data.write("data", 36); data.writeUInt32LE(pcm.length * 8, 40);
  for (let i = 0; i < pcm.length; i++) {
    data.writeFloatLE(pcm[i], 44 + i * 8); data.writeFloatLE(pcm[i], 48 + i * 8);
  }
  writeFileSync(file, data);
}

/** Quiet effects, plus an unnormalized mix bus when voice exists. Originals are never changed. */
export function assembleSfx(events: readonly RunnerEvent[], timeline: Timeline, voice: string | undefined,
  work: string, enabled = true): string | undefined {
  const sfx = join(work, "sfx.wav"), mix = join(work, "mix.bus.wav");
  for (const file of [sfx, mix, join(work, "mix.wav")]) rmSync(file, { force: true });
  const samples = Math.round((timeline.frames - timeline.cutFrames) * SAMPLE_RATE / timeline.fps);
  const placements = enabled ? planSfx(events, samples / 48) : [];
  if (!placements.length) return undefined;
  const manifest = JSON.parse(readFileSync(join(assets, "manifest.json"), "utf8")) as { files: Record<SoundAsset, { file: string }> };
  const speech = voice ? decode(voice) : undefined;
  const level = reference(speech);
  const bus = new Float32Array(samples);
  const decoded = new Map<string, Float32Array>();
  for (const { asset, sample } of placements) {
    let pcm = decoded.get(asset);
    if (!pcm) {
      const source = decode(join(assets, manifest.files[asset].file));
      let start = 0, end = source.length;
      while (start < end && Math.abs(source[start]) <= 0.0001) start++;
      while (end > start && Math.abs(source[end - 1]) <= 0.0001) end--;
      pcm = source.slice(start, end);
      if (!pcm.length) throw new Error(`sound asset contains no audio: ${asset}`);
      for (let i = 0; i < pcm.length; i++) pcm[i] *= Math.min(1, i / 48, (pcm.length - 1 - i) / 144);
      const gain = level * amplitude(asset.startsWith("typing") ? -18 : -12) / rms(pcm);
      for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;
      decoded.set(asset, pcm);
    }
    const count = Math.min(pcm.length, samples - sample);
    for (let i = 0; i < count; i++) {
      const fade = count < pcm.length ? Math.min(1, (count - 1 - i) / 144) : 1;
      bus[sample + i] += pcm[i] * fade;
    }
  }
  let peak = 0;
  for (const value of bus) peak = Math.max(peak, Math.abs(value));
  const reduction = peak > amplitude(-18) ? amplitude(-18) / peak : 1;
  for (let i = 0; i < samples; i++) bus[i] *= reduction;
  // Known clip intervals avoid pumping between syllables. Overlaps use the strongest dB reduction.
  const duck = new Float32Array(samples);
  if (speech) for (const step of timeline.steps) {
    if (!step.audio) continue;
    const start = step.startMs * 48, end = (step.startMs + step.audio.durationMs) * 48;
    for (let i = Math.max(0, Math.ceil(start - 1440)); i < Math.min(samples, end + 12000); i++) {
      const down = Math.min(1, (i - start + 1440) / 1440);
      const up = Math.min(1, (end + 12000 - i) / 12000);
      duck[i] = Math.max(duck[i], Math.min(down, up));
    }
  }
  for (let i = 0; i < samples; i++) bus[i] *= amplitude(-6 * duck[i]);
  writeStereo(sfx, bus);
  if (!speech) return sfx;
  for (let i = 0; i < samples; i++) bus[i] += speech[i] ?? 0;
  writeStereo(mix, bus);
  return mix;
}

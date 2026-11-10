import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Transcript, TranscriptStep } from "../schema/transcript.ts";

export interface ClipRequest { index: number; text: string; file: string }
export interface TtsAdapter {
  voice: NonNullable<Transcript["voice"]>;
  synthesize(jobs: readonly ClipRequest[]): Promise<void>;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const qwen: TtsAdapter = {
  voice: { adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0 },
  synthesize(jobs) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(join(root, "tts-venv/bin/python"), [join(root, "docker/tts/worker.py")], {
        env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
        stdio: ["pipe", "ignore", "pipe"], timeout: 900_000, killSignal: "SIGKILL",
      });
      let diagnostics = "";
      child.stderr.on("data", (chunk: Buffer) => { diagnostics = (diagnostics + chunk).slice(-65536); });
      child.once("error", (error) => reject(new Error(`Qwen TTS could not start: ${error.message}`, { cause: error })));
      child.stdin.on("error", () => {}); // startup/exit errors are reported with the worker diagnostics
      child.once("close", (code, signal) => {
        if (code !== 0) reject(new Error(`Qwen TTS failed (${signal ?? code}): ${diagnostics.trim()}`));
        else {
          if (diagnostics) process.stderr.write(diagnostics);
          resolve();
        }
      });
      child.stdin.end(JSON.stringify(jobs));
    });
  },
};

function clipMetadata(job: ClipRequest, audioDir: string) {
  try {
    const { streams: [audio], format } = JSON.parse(execFileSync("ffprobe", ["-v", "error",
      "-select_streams", "a:0", "-show_entries", "stream=codec_name,channels,duration:format=format_name",
      "-of", "json", job.file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    const durationMs = Math.round(Number(audio?.duration) * 1000);
    if (format.format_name !== "wav" || audio?.codec_name !== "pcm_s16le" || audio.channels !== 1
      || !Number.isFinite(durationMs) || durationMs <= 0) throw new Error("expected nonempty mono PCM16 WAV");
    return {
      file: `${basename(audioDir)}/${basename(job.file)}`, durationMs,
      sha256: createHash("sha256").update(readFileSync(job.file)).digest("hex"),
    };
  } catch (error) {
    throw new Error(`step ${job.index} audio is invalid: ${(error as Error).message}`, { cause: error });
  }
}

export async function voiceSteps(
  steps: readonly TranscriptStep[], audioDir: string, adapter: TtsAdapter = qwen,
): Promise<{ voice: TtsAdapter["voice"]; steps: TranscriptStep[] }> {
  mkdirSync(audioDir, { recursive: true });
  const staging = mkdtempSync(join(audioDir, ".pending-"));
  try {
    const jobs = steps.flatMap((step) => {
      const text = (step.narration ?? "").replace(/\s+/g, " ").trim();
      return text ? [{ index: step.index, text, file: join(staging, `${String(step.index).padStart(3, "0")}.wav`) }] : [];
    });
    if (jobs.length) await adapter.synthesize(jobs);
    const audio = new Map(jobs.map((job) => [job.index, clipMetadata(job, audioDir)]));
    for (const entry of readdirSync(audioDir, { withFileTypes: true })) {
      if (entry.isFile() && /^\d{3,}\.wav$/.test(entry.name)) rmSync(join(audioDir, entry.name));
    }
    for (const job of jobs) renameSync(job.file, join(audioDir, basename(job.file)));
    return { voice: adapter.voice, steps: steps.map(({ audio: _, ...step }) => {
      const clip = audio.get(step.index);
      return clip ? { ...step, audio: clip } : step;
    }) };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

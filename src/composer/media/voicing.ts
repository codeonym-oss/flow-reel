// Voices a script's comments through the voice port and records each clip's measured metadata. A comment the
// previous reel already voiced the same way reuses its clip (the reel cache, GH-33 decision 002).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type { ClipRequest, Voice } from "../ports.ts";
import { type Transcript, type TranscriptStep, validateTranscript } from "../schema/transcript.ts";

const normalize = (comment: string | undefined) => (comment ?? "").replace(/\s+/g, " ").trim();
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/**
 * The previous reel's clips by normalized comment, when that reel was voiced with the same voice settings. Only a clip
 * whose bytes still match the hash its transcript recorded is offered; an unreadable reel offers none.
 */
function previousClips(previous: string | undefined, voice: Voice["voice"]): Map<string, string> {
  const clips = new Map<string, string>();
  if (!previous) return clips;
  let transcript: unknown;
  try { transcript = JSON.parse(readFileSync(join(previous, "transcript.json"), "utf8")); } catch { return clips; }
  if (validateTranscript(transcript).length) return clips;
  const old = (transcript as Transcript).voice;
  if (!old || (["adapter", "voice", "seed", "language"] as const).some((key) => old[key] !== voice[key])) return clips;
  for (const step of (transcript as Transcript).steps) {
    const text = normalize(step.comment);
    if (!step.audio || !text || clips.has(text)) continue;
    const file = resolve(previous, step.audio.file);
    const inside = relative(previous, file);
    if (!inside || inside.startsWith("..") || isAbsolute(inside)) continue;
    let bytes: Buffer;
    try { bytes = readFileSync(file); } catch { continue; }
    if (sha256(bytes) === step.audio.sha256) clips.set(text, file);
  }
  return clips;
}

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
      sha256: sha256(readFileSync(job.file)),
    };
  } catch (error) {
    throw new Error(`step ${job.index} audio is invalid: ${(error as Error).message}`, { cause: error });
  }
}

/** `previous` is the folder of the reel already on disk, whose clips may be reused. */
export async function voiceSteps(
  steps: readonly TranscriptStep[], audioDir: string, adapter: Voice, previous?: string,
): Promise<{ voice: Voice["voice"]; steps: TranscriptStep[]; voiced: number; reused: number }> {
  mkdirSync(audioDir, { recursive: true });
  const staging = mkdtempSync(join(audioDir, ".pending-"));
  try {
    const jobs = steps.flatMap((step) => {
      const text = normalize(step.comment);
      return text ? [{ index: step.index, text, file: join(staging, `${String(step.index).padStart(3, "0")}.wav`) }] : [];
    });
    const cached = previousClips(previous, adapter.voice);
    const fresh = jobs.filter((job) => {
      const clip = cached.get(job.text);
      if (clip) copyFileSync(clip, job.file);
      return !clip;
    });
    if (fresh.length) await adapter.synthesize(fresh);
    const audio = new Map(jobs.map((job) => [job.index, clipMetadata(job, audioDir)]));
    for (const entry of readdirSync(audioDir, { withFileTypes: true })) {
      if (entry.isFile() && /^\d{3,}\.wav$/.test(entry.name)) rmSync(join(audioDir, entry.name));
    }
    for (const job of jobs) renameSync(job.file, join(audioDir, basename(job.file)));
    return { voice: adapter.voice, voiced: fresh.length, reused: jobs.length - fresh.length,
      steps: steps.map(({ audio: _, ...step }) => {
        const clip = audio.get(step.index);
        return clip ? { ...step, audio: clip } : step;
      }) };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

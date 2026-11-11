// Caption sidecars use the transcript's final, calibrated timeline (GH-3 decisions 001-004).
import type { TranscriptStep } from "../schema/transcript.ts";

function timestamp(ms: number, separator: string): string {
  ms = Math.round(ms);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":")
    + separator + String(ms % 1000).padStart(3, "0");
}

export function renderCaptions(steps: readonly TranscriptStep[]): { srt: string; vtt: string } {
  let srt = "";
  let vtt = "WEBVTT\n\n";
  let index = 0;
  for (const step of steps) {
    const text = (step.narration ?? "").replace(/\s+/g, " ").trim()
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (!text || step.endMs <= step.startMs) continue;
    index++;
    const cue = (separator: string) => `${index}\n${timestamp(step.startMs, separator)} --> `
      + `${timestamp(step.endMs, separator)}\n${text}\n\n`;
    srt += cue(",");
    vtt += cue(".");
  }
  return { srt, vtt };
}

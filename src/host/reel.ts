// Builds a run's finished reel in its folder, from the results of its phases.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reelText } from "../composer/reel.ts";
import { type CueSheet, validateCues } from "../composer/schema/cues.ts";
import { CUES_FILE, PLAN_FILE, RENDERED_FILE, VIDEO_FILE, VOICED_FILE } from "../composer/schema/files.ts";
import type { Manifest } from "../composer/schema/manifest.ts";
import { type Plan, validatePlan } from "../composer/schema/plan.ts";
import { readJson } from "../composer/schema/read.ts";
import { type Rendered, validateRendered } from "../composer/schema/rendered.ts";
import { type Voiced, validateVoiced } from "../composer/schema/voiced.ts";
import { MANIFEST, hashFiles, listReelFiles } from "../reel.ts";
import { linkFile, renameWhenFree } from "./files.ts";
import { resultDir } from "./results.ts";

export const reelDir = (runDir: string): string => join(runDir, "reel");

export const readCues = (runDir: string) => readJson<CueSheet>(join(resultDir(runDir, "record"), CUES_FILE), validateCues);
export const readVoiced = (runDir: string) => readJson<Voiced>(join(resultDir(runDir, "voice"), VOICED_FILE), validateVoiced);
export const readPlan = (runDir: string) => readJson<Plan>(join(resultDir(runDir, "plan"), PLAN_FILE), validatePlan);

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export async function buildReel(runDir: string, composerVersion: string): Promise<string> {
  const voiced = readVoiced(runDir);
  const { durationMs } = readJson<Rendered>(join(resultDir(runDir, "render"), RENDERED_FILE), validateRendered);
  const text = reelText({ cues: readCues(runDir), voiced, plan: readPlan(runDir), durationMs, video: VIDEO_FILE, composerVersion });
  const dir = reelDir(runDir);
  const building = `${dir}.tmp`;
  rmSync(building, { recursive: true, force: true });
  mkdirSync(building);
  linkFile(join(resultDir(runDir, "render"), VIDEO_FILE), join(building, VIDEO_FILE));
  mkdirSync(join(building, "audio"));
  for (const { audio } of voiced.clips) linkFile(join(resultDir(runDir, "voice"), audio.file), join(building, audio.file));
  writeFileSync(join(building, "transcript.json"), json(text.transcript));
  writeFileSync(join(building, "events.json"), json(text.events));
  writeFileSync(join(building, "captions.srt"), text.captions.srt);
  writeFileSync(join(building, "captions.vtt"), text.captions.vtt);
  const manifest: Manifest = { version: 1, ...text.about, files: hashFiles(building, listReelFiles(building)) };
  writeFileSync(join(building, MANIFEST), json(manifest));
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  await renameWhenFree(building, dir);
  return dir;
}

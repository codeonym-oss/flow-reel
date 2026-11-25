// A run in a throwaway data folder, for the tests of what drives and watches one.
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { makeResult } from "../../src/host/results.ts";
import { type Run, createRun } from "../../src/host/run-folder.ts";
import { type Phase, RESULTS, type ResultPhase } from "../../src/run/phases.ts";
import { resolveSettings } from "../../src/settings.ts";
import type { Config } from "../../src/workspace/config.ts";
import { findScript, reelFolder } from "../../src/workspace/workspace.ts";

const dirs: string[] = [];
// A run's process ends just after its last entry, and Windows keeps its folder until then. Not rmSync: Node 22's
// doesn't retry a folder that is busy itself.
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 10 }); });

export function folder(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "flow-reel-run-")));
  dirs.push(dir);
  return dir;
}

export const CONFIG: Config = { version: 2, workspace: { id: "abcdefghijkl", slug: "shop", title: "Shop" }, scripts: "reels", output: "reels/out" };

/** A workspace with one script, `a`. */
export function project(): string {
  const root = folder();
  writeFileSync(join(root, "flow-reel.json"), JSON.stringify(CONFIG));
  mkdirSync(join(root, "reels"));
  writeFileSync(join(root, "reels/a.reel.ts"), "a");
  return root;
}

export function startRun(data: string, root = project()): Promise<Run> {
  const found = findScript(join(root, "reels/a.reel.ts"));
  return createRun(data, { ...found, settings: resolveSettings(undefined), sound: true, reel: reelFolder(found.workspace, found.script),
    credentials: [], flowReel: "0.8.0" });
}

/** Does a phase without a container: its result holds one file. */
export async function doPhase(run: Run, phase: Phase): Promise<void> {
  if (!(RESULTS as readonly Phase[]).includes(phase)) return;
  await makeResult(run.dir, phase as ResultPhase, async (out) => { writeFileSync(join(out, `${phase}.txt`), phase); });
}

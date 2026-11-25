// A run's folder (GH-108 decisions 014 and 015): what was asked, the copy of the scripts folder it works on, and the clips
// of the reel it replaces.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { rename } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { Brand } from "../composer/cards/brand.ts";
import type { Settings } from "../settings.ts";
import { type Workspace, type WorkspaceScript, skipped } from "../workspace/workspace.ts";
import { workspaceDir } from "./data.ts";
import { copyFile, copyTree, describeFiles, listFiles, sha256, slashes, treeHash, writeDurable } from "./files.ts";

/** What was asked of a run. It never changes, and holds no key. */
export interface RunRequest {
  version: 1;
  /** The version of flow-reel that made the run. */
  flowReel: string;
  workspace: { id: string; title: string; root: string };
  /** The script's name and path in the scripts folder, its hash, and one for the whole folder as it was copied. */
  script: { name: string; path: string; sha256: string; folder: string };
  settings: Settings;
  brand: Brand;
  sound: boolean;
  /** The folder the reel goes to. */
  reel: string;
  /** The environment variables that hold the voice's key. */
  credentials: string[];
  startedAt: string;
}

export interface Run {
  /** 1, 2, 3 in its workspace: the order runs were started in. */
  number: number;
  dir: string;
  request: RunRequest;
}

export const REQUEST_FILE = "request.json";
/** What a run's containers, its script and its process print. */
export const logFile = (runDir: string): string => join(runDir, "log.txt");
export const runsDir = (data: string, workspaceId: string): string => join(workspaceDir(data, workspaceId), "runs");

/** What a run's copy of the scripts folder leaves out: reels, packages, hidden files and the output folder. */
function leftOut({ scriptsDir, outputDir }: Workspace): (path: string) => boolean {
  const output = slashes(relative(scriptsDir, outputDir));
  return (path) => path === output || skipped(path.split("/").at(-1)!);
}

/** One hash for a workspace's scripts folder, as a run copies it. */
export async function scriptsHash(workspace: Workspace): Promise<string> {
  const { scriptsDir } = workspace;
  return treeHash(await describeFiles(scriptsDir, listFiles(scriptsDir, leftOut(workspace))));
}

export interface RunOrder {
  workspace: Workspace;
  script: WorkspaceScript;
  settings: Settings;
  sound: boolean;
  reel: string;
  credentials: string[];
  flowReel: string;
}

/** Makes a run's folder, complete, and gives it the next number. */
export async function createRun(data: string, { workspace, script, settings, sound, reel, credentials, flowReel }: RunOrder): Promise<Run> {
  const runs = runsDir(data, workspace.config.workspace.id);
  mkdirSync(runs, { recursive: true });
  // Built under a name that isn't a number, then renamed: a run is whole or isn't there.
  const building = mkdtempSync(join(runs, ".new-"));
  try {
    const scripts = join(building, "scripts");
    copyTree(workspace.scriptsDir, scripts, leftOut(workspace));
    const previous = join(building, "previous");
    mkdirSync(previous);
    keepClips(reel, previous);
    const { id, title } = workspace.config.workspace;
    const request: RunRequest = { version: 1, flowReel, workspace: { id, title, root: workspace.root },
      script: { name: script.name, path: script.path, sha256: await sha256(join(scripts, script.path)),
        folder: treeHash(await describeFiles(scripts, listFiles(scripts))) },
      settings, brand: workspace.config.brand ?? {}, sound, reel, credentials, startedAt: new Date().toISOString() };
    writeDurable(join(building, REQUEST_FILE), `${JSON.stringify(request, null, 2)}\n`);
    for (;;) {
      const number = Math.max(0, ...runNumbers(runs)) + 1;
      const dir = join(runs, String(number));
      // Two runs started at once can choose one number: renaming onto a folder that holds a run fails, and the loser
      // takes the next.
      if (existsSync(dir)) continue;
      try { await rename(building, dir); }
      catch (error) {
        if (["ENOTEMPTY", "EEXIST", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "") && existsSync(dir)) continue;
        throw error;
      }
      return { number, dir, request };
    }
  } catch (error) {
    rmSync(building, { recursive: true, force: true });
    throw error;
  }
}

/** Copies what the reel cache needs of the reel being replaced: its transcript and its clips. */
function keepClips(reel: string, to: string): void {
  if (!existsSync(join(reel, "transcript.json"))) return;
  copyFile(join(reel, "transcript.json"), join(to, "transcript.json"));
  if (existsSync(join(reel, "audio"))) copyTree(join(reel, "audio"), join(to, "audio"));
}

const runNumbers = (runs: string): number[] => readdirSync(runs).filter((name) => /^[1-9]\d*$/.test(name)).map(Number);

/** The numbers of a workspace's runs, newest first. */
export function runNumbersOf(data: string, workspaceId: string): number[] {
  const runs = runsDir(data, workspaceId);
  return existsSync(runs) ? runNumbers(runs).sort((a, b) => b - a) : [];
}

export const readRun = (data: string, workspaceId: string, number: number): Run | undefined =>
  readRunIn(join(runsDir(data, workspaceId), String(number)));

/** The run in a folder, if it holds one. */
export function readRunIn(dir: string): Run | undefined {
  if (!existsSync(join(dir, REQUEST_FILE))) return undefined;
  return { number: Number(basename(dir)), dir, request: JSON.parse(readFileSync(join(dir, REQUEST_FILE), "utf8")) as RunRequest };
}

// What the Scripts screen reads (GH-136): a workspace's scripts with what their last reel holds, a script's source with the
// lines changed since that reel, and opening a script by its path.
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { type KnownWorkspace, knownWorkspaces, localSlug, rememberWorkspace } from "../host/data.ts";
import { sha256Text } from "../host/files.ts";
import { readRunIn } from "../host/run-folder.ts";
import { trackedRuns } from "../host/tracker.ts";
import { readConfig } from "../workspace/config.ts";
import { type Workspace, type WorkspaceScript, findScript, listScripts, reelFolder, workspaceAt } from "../workspace/workspace.ts";
import type { OpenedScript, ReelCounts, ScriptSource, ScriptsView, ScriptView } from "./api.ts";
import type { OnSave } from "./on-save.ts";
import { Refused, view } from "./workspaces.ts";

/** The workspace with this id, and its folder that still holds it. */
export function workspaceOf(data: string, id: string): { known: KnownWorkspace; workspace: Workspace } {
  const known = knownWorkspaces(data).find((one) => one.id === id);
  if (!known) throw new Refused(404, `there is no workspace ${id} on this computer`);
  for (const root of known.roots) {
    try {
      const found = readConfig(root);
      if (found?.kind === "config" && found.config.workspace.id === id) return { known, workspace: workspaceAt(root, found.config) };
    } catch { /* another folder may still hold it */ }
  }
  throw new Refused(404, `${known.title}'s folder is gone (${known.roots[0]})`);
}

export function scriptOf(workspace: Workspace, name: string): WorkspaceScript {
  const script = listScripts(workspace).find((one) => one.name === name);
  if (!script) throw new Refused(404, `${workspace.config.workspace.title} has no script ${name}`);
  return script;
}

const readJson = (file: string): unknown => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return undefined; } };

const EFFECTS = new Set(["zoom", "flash", "speed", "skip", "overlay"]);

/** What a reel's files say it holds; undefined without a complete reel. */
function counts(reel: string): (ReelCounts & { at: string; script: string }) | undefined {
  const transcript = readJson(join(reel, "transcript.json")) as { video?: { durationMs?: number }; steps?: { comment?: string }[] } | undefined;
  const events = readJson(join(reel, "events.json")) as { events?: { type?: string }[] } | undefined;
  const manifest = readJson(join(reel, "manifest.json")) as { script?: { sha256?: string } } | undefined;
  if (!transcript?.steps || !events?.events || !manifest?.script?.sha256) return undefined;
  const kinds = events.events.map(({ type }) => type ?? "");
  return { steps: transcript.steps.length, comments: transcript.steps.filter(({ comment }) => comment?.trim()).length,
    sounds: kinds.filter((type) => type === "sound").length, effects: kinds.filter((type) => EFFECTS.has(type)).length,
    cards: kinds.filter((type) => type === "card").length, ms: transcript.video?.durationMs ?? 0,
    at: statSync(join(reel, "manifest.json")).mtime.toISOString(), script: manifest.script.sha256 };
}

export async function scripts(data: string, id: string, onSave: Pick<OnSave, "isOn" | "failure">): Promise<ScriptsView> {
  const { known, workspace } = workspaceOf(data, id);
  const tracked = trackedRuns(data, id);
  const list = await Promise.all(listScripts(workspace).map(async (script): Promise<ScriptView> => {
    const reel = counts(reelFolder(workspace, script));
    const runs = await Promise.all(tracked.filter((run) => run.script === script.name).slice(0, 5).map((run) => view(known, run)));
    return { name: script.name, path: script.path, ...(reel ? { reel: { steps: reel.steps, comments: reel.comments, sounds: reel.sounds,
      effects: reel.effects, cards: reel.cards, ms: reel.ms, at: reel.at } } : {}), runs, onSave: onSave.isOn(script.file),
      ...(onSave.failure(script.file) ? { onSaveFailed: onSave.failure(script.file) } : {}) };
  }));
  const { workspace: identity, scripts: folder } = workspace.config;
  return { workspace: { id, slug: localSlug(known), title: identity.title, root: workspace.root, scripts: folder }, scripts: list };
}

/** The lines of `now` (from 1) that aren't in `before`, by their longest common subsequence. */
export function changedLines(before: string[], now: string[]): number[] {
  const n = before.length, m = now.length;
  const longest = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      longest[i]![j] = before[i] === now[j] ? longest[i + 1]![j + 1]! + 1 : Math.max(longest[i + 1]![j]!, longest[i]![j + 1]!);
    }
  }
  const changed: number[] = [];
  let i = 0, j = 0;
  while (j < m) {
    if (i < n && before[i] === now[j]) { i++; j++; }
    else if (i < n && longest[i + 1]![j]! >= longest[i]![j + 1]!) i++;
    else changed.push(++j);
  }
  return changed;
}

const LONGEST_DIFF = 5000;

export function source(data: string, id: string, name: string): ScriptSource {
  const { workspace } = workspaceOf(data, id);
  const script = scriptOf(workspace, name);
  const text = readFileSync(script.file, "utf8");
  const lines = text.split(/\r?\n/);
  const base = { name, path: script.path, lines };
  const reel = counts(reelFolder(workspace, script));
  if (!reel) return { ...base, changed: [], noReel: true };
  if (reel.script === sha256Text(text)) return { ...base, changed: [] };
  // The run that made the reel copied the script as it was then.
  for (const { dir, state } of trackedRuns(data, id)) {
    const run = state.state === "done" ? readRunIn(dir) : undefined;
    if (run?.request.script.name !== name || run.request.script.sha256 !== reel.script) continue;
    const copy = join(dir, "scripts", run.request.script.path);
    if (!existsSync(copy)) break;
    const before = readFileSync(copy, "utf8").split(/\r?\n/);
    if (before.length > LONGEST_DIFF || lines.length > LONGEST_DIFF) break;
    return { ...base, changed: changedLines(before, lines) };
  }
  return { ...base, changed: "unknown" };
}

/** Opens a script by its full path (decision 005): its workspace is remembered, as `compose` does. */
export function openScript(data: string, path: string): OpenedScript {
  const file = path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
  if (!isAbsolute(file)) throw new Refused(400, `${path} isn't a full path: start it with / or ~/`);
  let found;
  try { found = findScript(file); } catch (error) { throw new Refused(400, (error as Error).message); }
  const known = rememberWorkspace(data, found.workspace);
  return { workspace: known.id, slug: localSlug(known), name: found.script.name };
}

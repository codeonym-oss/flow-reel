// What the Workspaces screen reads and changes (GH-135): the workspaces on this computer, their runs, today's turns at
// heavy work, adding one, and cleaning, read and done as the commands do.
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { type KnownWorkspace, SlugTakenError, knownWorkspaces, localSlug, rememberWorkspace, slugOwner } from "../host/data.ts";
import { readJournal } from "../host/journal.ts";
import { isHeavy } from "../host/queue.ts";
import { cleanable, hasHeavyFiles, heavyBytes } from "../host/retention.ts";
import { whatNext } from "../host/resume.ts";
import { readRunIn } from "../host/run-folder.ts";
import { type Tracked, trackedRuns } from "../host/tracker.ts";
import { isEnded } from "../run/machine.ts";
import type { Phase } from "../run/phases.ts";
import { readConfig } from "../workspace/config.ts";
import { initialize, proposedScripts, slugify, survey } from "../workspace/init.ts";
import { listScripts, workspaceAt } from "../workspace/workspace.ts";
import type { AddWorkspace, AddedWorkspace, CleanPreview, Cleaned, RunView, TurnView, WorkspaceView } from "./api.ts";

/** A request the person can fix: the server answers it with 400 or 409 and this message. */
export class Refused extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function view(known: KnownWorkspace, { number, dir, script, startedAt, endedAt, state }: Tracked): Promise<RunView> {
  const run = isEnded(state) ? readRunIn(dir) : undefined;
  const next = run && await whatNext(run, state);
  return { id: `${localSlug(known)}/${number}`, workspace: known.id, script, startedAt, ...(endedAt ? { endedAt } : {}),
    state: state.state, ...(state.phase ?? state.ended?.phase ? { phase: state.phase ?? state.ended?.phase } : {}), finished: state.finished.length,
    ...(state.waiting ? { waiting: state.waiting } : {}), ...(state.ended ? { why: state.ended.message } : {}),
    ...(next && "resume" in next ? { resume: next.resume } : {}), ...(next && "lost" in next ? { lost: next.lost } : {}),
    files: hasHeavyFiles(dir) };
}

/** Every run on this computer, newest first. */
export async function runs(data: string): Promise<RunView[]> {
  const all = await Promise.all(knownWorkspaces(data).flatMap((known) => trackedRuns(data, known.id).map((run) => view(known, run))));
  return all.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

const holds = (root: string, id: string) => {
  try {
    const found = readConfig(root);
    return found?.kind === "config" && found.config.workspace.id === id ? found.config : undefined;
  } catch { return undefined; }
};

export async function workspaces(data: string, now = Date.now()): Promise<WorkspaceView[]> {
  return Promise.all(knownWorkspaces(data).map(async (known): Promise<WorkspaceView> => {
    const tracked = trackedRuns(data, known.id);
    const root = known.roots.find((root) => holds(root, known.id));
    const config = root && holds(root, known.id);
    const latest = tracked[0] && await view(known, tracked[0]);
    return { id: known.id, slug: localSlug(known), title: known.title, root: root ?? known.roots[0] ?? "", missing: !config,
      scripts: config ? listScripts(workspaceAt(root!, config)).length : 0, runs: tracked.length, ...(latest ? { latest } : {}),
      last: tracked.slice(0, 12).reverse().map(({ state, startedAt, endedAt }) =>
        ({ state: state.state, seconds: Math.round(((endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt)) / 1000) })),
      bytes: tracked.reduce((sum, { dir }) => sum + heavyBytes(dir), 0) };
  }));
}

/** The turns at heavy work, and the waits for them, of the runs that went on after `since`. */
export function today(data: string, since: number): TurnView[] {
  const turns: TurnView[] = [];
  for (const known of knownWorkspaces(data)) {
    for (const { number, dir, endedAt, state } of trackedRuns(data, known.id)) {
      if (endedAt && Date.parse(endedAt) < since) continue;
      const request = readRunIn(dir)?.request;
      if (!request) continue;
      const base = { run: `${localSlug(known)}/${number}`, workspace: known.id, state: state.state };
      let open: TurnView | undefined;
      const close = (at: string) => { if (open) { turns.push({ ...open, to: at }); open = undefined; } };
      for (const entry of readJournal(dir)) {
        if (entry.type === "waiting") { close(entry.at); open = { ...base, phase: entry.phase, kind: "wait", from: entry.at }; }
        else if (entry.type === "phase-started") {
          close(entry.at);
          if (isHeavy(entry.phase as Phase, request.settings)) open = { ...base, phase: entry.phase, kind: "turn", from: entry.at };
        } else if (["phase-finished", "held", "failed", "stopped", "cancelled", "done"].includes(entry.type)) close(entry.at);
      }
      if (open) turns.push(open);
    }
  }
  return turns.filter(({ to }) => to === undefined || Date.parse(to) >= since);
}

/** Remembers a project as a workspace, or makes it one with `init`. */
export function addWorkspace(data: string, { path, init }: AddWorkspace): AddedWorkspace {
  const root = path.startsWith("~/") ? join(homedir(), path.slice(2)) : path === "~" ? homedir() : path;
  if (!isAbsolute(root)) throw new Refused(400, `${path} isn't a full path: start it with / or ~/`);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Refused(400, `there is no folder at ${root}`);
  const remember = (workspace: Parameters<typeof rememberWorkspace>[1]) => {
    try {
      const known = rememberWorkspace(data, workspace);
      return { added: { id: known.id, slug: localSlug(known), title: known.title } };
    } catch (error) {
      if (error instanceof SlugTakenError) throw new Refused(409, error.message);
      throw error;
    }
  };
  let found;
  try { found = readConfig(root); } catch (error) { throw new Refused(400, (error as Error).message); }
  if (found?.kind === "config") return remember(workspaceAt(root, found.config));
  let surveyed;
  try { surveyed = survey(root); } catch (error) { throw new Refused(400, (error as Error).message); }
  if (!init) return { needs: "init", root, title: basename(root), scripts: proposedScripts(surveyed) };
  const title = init.title.trim();
  try {
    const owner = slugOwner(data, slugify(title));
    if (owner) throw new Refused(409, `"${localSlug(owner)}" is already the name of ${owner.title} (${owner.roots[0]}) on this computer: choose another title`);
    return remember(initialize(root, surveyed, { title }));
  } catch (error) {
    if (error instanceof Refused) throw error;
    throw new Refused(400, (error as Error).message);
  }
}

function known(data: string, id: string): KnownWorkspace {
  const found = knownWorkspaces(data).find((one) => one.id === id);
  if (!found) throw new Refused(404, `there is no workspace ${id} on this computer`);
  return found;
}

export async function cleanPreview(data: string, id: string): Promise<CleanPreview> {
  const going = (await cleanable(data, [known(data, id)])).filter(({ what }) => "run" in what);
  return { runs: going.length, bytes: going.reduce((sum, { bytes }) => sum + bytes, 0) };
}

/** Removes what `flow-reel clean` would; a run that is going on again keeps its files. */
export async function clean(data: string, id: string): Promise<Cleaned> {
  const cleaned: Cleaned = { runs: 0, bytes: 0 };
  for (const { what, bytes, remove } of await cleanable(data, [known(data, id)])) {
    if (await remove() && "run" in what) { cleaned.runs++; cleaned.bytes += bytes; }
  }
  return cleaned;
}

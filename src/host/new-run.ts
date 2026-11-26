// Starting a run of a script (GH-136 decision 003), or letting one go on (GH-137 decision 002): what `flow-reel compose` does before it watches, and what the studio's
// Run button does. The run's own process does the rest (epic GH-107 decision 023).
import { type Settings, type SettingsFlags, credentialsFor, resolveSettings } from "../settings.ts";
import { type RunState } from "../run/machine.ts";
import { type Workspace, findScript, findWorkspace, reelFolder } from "../workspace/workspace.ts";
import { localSlug, rememberWorkspace } from "./data.ts";
import { detectEngine, ensureImage, packageVersion, targetFor } from "./engine.ts";
import { whatNext } from "./resume.ts";
import { type Run, createRun, scriptsHash } from "./run-folder.ts";
import { startProcess } from "./start.ts";

export interface ComposeAsk {
  /** The script's file. */
  path: string;
  /** The reel's folder, instead of the workspace's output folder. */
  out?: string;
  sound?: boolean;
  flags?: SettingsFlags;
  /** Where the voice's key is: the environment of whoever starts the run. */
  env?: NodeJS.ProcessEnv;
  say: (message: string) => void;
}

export interface Started { id: string; run: Run; workspace: Workspace; settings: Settings }

/** Starts a run of a script, and returns once its process owns it. */
export async function startCompose(data: string, { path, out, sound = true, flags = {}, env = process.env, say }: ComposeAsk): Promise<Started> {
  const { workspace, script } = findScript(path);
  const known = rememberWorkspace(data, workspace);
  const settings = resolveSettings(workspace.config, flags);
  const credentials = credentialsFor(settings, env);
  const version = packageVersion();
  const engine = detectEngine();
  const image = ensureImage(engine, version, targetFor(settings.voice.adapter), say);
  const run = await createRun(data, { workspace, script, settings, sound, reel: reelFolder(workspace, script, out), credentials, flowReel: version });
  await startProcess(run, { engine, image });
  return { id: `${localSlug(known)}/${run.number}`, run, workspace, settings };
}

export interface ResumeAsk {
  env?: NodeJS.ProcessEnv;
  say: (message: string) => void;
}

/** Lets a run that stopped or failed go on with what it has (`flow-reel resume`); throws saying why it can't. */
export async function resumeRun(id: string, run: Run, state: RunState, { env = process.env, say }: ResumeAsk): Promise<void> {
  const next = await whatNext(run, state);
  if (!next) throw new Error(`${id} is ${state.state}: it has nothing to go on with`);
  if ("lost" in next) throw new Error(`${id} can't go on (${next.lost}): compose its script again to start a new run`);
  const { request } = run;
  const missing = next.resume === "voice" ? request.credentials.find((name) => !env[name]) : undefined;
  if (missing) throw new Error(`voice ${request.settings.voice.adapter} needs ${missing}: set it in the environment and resume again`);
  if (await changedSince(run)) say(`the scripts have changed since ${id} started: it goes on with the ones it started with`);
  const engine = detectEngine();
  const image = ensureImage(engine, packageVersion(), targetFor(request.settings.voice.adapter), say);
  await startProcess(run, { engine, image });
}

/** Whether the project's scripts aren't the ones the run works on; a project that isn't there any more says nothing. */
async function changedSince({ request }: Run): Promise<boolean> {
  try { return await scriptsHash(findWorkspace(request.workspace.root)) !== request.script.folder; }
  catch { return false; }
}

// Starting a run of a script (GH-136 decision 003): what `flow-reel compose` does before it watches, and what the studio's
// Run button does. The run's own process does the rest (epic GH-107 decision 023).
import { type Settings, type SettingsFlags, credentialsFor, resolveSettings } from "../settings.ts";
import { type Workspace, findScript, reelFolder } from "../workspace/workspace.ts";
import { localSlug, rememberWorkspace } from "./data.ts";
import { detectEngine, ensureImage, packageVersion, targetFor } from "./engine.ts";
import { type Run, createRun } from "./run-folder.ts";
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

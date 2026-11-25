// A workspace for the e2e tests, composed with the built CLI as a person would; its runs stay in test/e2e/out/data.
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { Config } from "../../src/workspace/config.ts";
import { newId, slugify } from "../../src/workspace/init.ts";
import { FAKE_KEY } from "./fixture-app.ts";

export const DATA_DIR = resolve("test/e2e/out/data");

export interface Project { root: string; scripts: string; output: string }

/** A fresh workspace in `root`, with `files` in its scripts folder. */
export function makeProject(root: string, files: Record<string, string>, config: Pick<Config, "voice" | "brand"> = {}): Project {
  rmSync(root, { recursive: true, force: true });
  const scripts = join(root, "reels");
  mkdirSync(root, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(scripts, path)), { recursive: true });
    writeFileSync(join(scripts, path), content);
  }
  const title = relative(resolve("test/e2e/out"), root);
  const full: Config = { version: 2, workspace: { id: newId(), slug: slugify(title), title }, scripts: "reels", output: "reels/out", ...config };
  writeFileSync(join(root, "flow-reel.json"), `${JSON.stringify(full, null, 2)}\n`);
  return { root, scripts, output: join(scripts, "out") };
}

/** The folder of a project's latest run. */
export function lastRun(project: Project): string {
  const { workspace } = JSON.parse(readFileSync(join(project.root, "flow-reel.json"), "utf8")) as Config;
  const runs = join(DATA_DIR, "workspaces", workspace.id, "runs");
  return join(runs, String(Math.max(...readdirSync(runs).map(Number).filter(Number.isInteger))));
}

export const cliEnv = (env: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv =>
  ({ ...process.env, FLOW_REEL_DATA_DIR: DATA_DIR, OPENAI_API_KEY: FAKE_KEY, ...env });

/**
 * Composes a script of the project and returns its reel's folder and what was printed, which is kept in record.log too.
 * Async: the fixture server lives in this process, so the event loop must stay free while the composer records.
 */
export async function compose(project: Project, name = "demo", args: string[] = [], env?: NodeJS.ProcessEnv): Promise<{ reel: string; stderr: string }> {
  const log = join(project.root, "record.log");
  try {
    const { stderr } = await promisify(execFile)(process.execPath, ["dist/cli.js", "compose", join(project.scripts, `${name}.reel.ts`), ...args],
      { env: cliEnv(env), maxBuffer: 1 << 24 });
    writeFileSync(log, stderr);
    return { reel: join(project.output, `${name}.reel`), stderr };
  } catch (error) {
    writeFileSync(log, (error as { stderr?: string }).stderr ?? String(error));
    throw error;
  }
}

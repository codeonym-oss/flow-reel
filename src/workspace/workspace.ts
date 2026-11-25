// Finds the workspace a path belongs to, and names its scripts and reels (GH-108 decisions 001 to 003).
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { CONFIG_FILE, type Config, readConfig } from "./config.ts";

export interface Workspace {
  /** The absolute folder holding `flow-reel.json`. */
  root: string;
  config: Config;
  /** Absolute. */
  scriptsDir: string;
  /** Absolute. */
  outputDir: string;
}

export interface WorkspaceScript {
  /** Its path in the scripts folder without `.reel.ts` or `.reel.js`, with forward slashes: `admin/refund`. */
  name: string;
  /** Its path in the scripts folder, with forward slashes: `admin/refund.reel.ts`. */
  path: string;
  /** Absolute. */
  file: string;
}

const SCRIPT = /\.reel\.(ts|js)$/;
const slashes = (path: string) => path.split(sep).join("/");
/** Whether a path given by `relative` stays inside its folder; on Windows, another drive gives an absolute path. */
const isInside = (path: string) => path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);

/** The folders from `from` up to the filesystem's root that hold a `flow-reel.json`, nearest first. */
export function configFolders(from: string): string[] {
  const found: string[] = [];
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, CONFIG_FILE))) found.push(dir);
    if (dirname(dir) === dir) return found;
  }
}

/** The workspace that holds `from`, a folder; throws saying what to do when there is none, or more than one. */
export function findWorkspace(from: string): Workspace {
  const [root, above] = configFolders(from);
  if (root === undefined) {
    throw new Error(`${from} isn't in a workspace: run \`flow-reel init\` in the project's folder first`);
  }
  const found = readConfig(root)!;
  if (found.kind === "legacy") {
    throw new Error(`${join(root, CONFIG_FILE)} is from before flow-reel 0.8: run \`flow-reel init\` in the project's ` +
      "folder to take its settings over");
  }
  if (above !== undefined) throw nested(join(root, CONFIG_FILE), join(above, CONFIG_FILE));
  return workspaceAt(root, found.config);
}

export function workspaceAt(root: string, config: Config): Workspace {
  return { root, config, scriptsDir: resolve(root, config.scripts), outputDir: resolve(root, config.output) };
}

const nested = (inner: string, outer: string) => new Error(`${inner} is inside the workspace of ${outer}: a workspace has ` +
  `one ${CONFIG_FILE}. Move the inner file's voice and brand into the outer one, or remove the outer one so that each ` +
  "folder is a workspace of its own");

/** Folders whose files are never scripts: hidden ones, installed packages and reels. */
export const skipped = (name: string) => name.startsWith(".") || name === "node_modules" || /\.reel(\.partial)?$/.test(name);

/**
 * Every script of the workspace, sorted by name. Throws when the scripts folder holds a `flow-reel.json`, which would be
 * a second one in the workspace.
 */
export function listScripts(workspace: Workspace): WorkspaceScript[] {
  const { scriptsDir, outputDir, root } = workspace;
  const walk = (dir: string): WorkspaceScript[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.name === CONFIG_FILE) throw nested(file, join(root, CONFIG_FILE));
    const stat = entry.isSymbolicLink() ? statSync(file, { throwIfNoEntry: false }) : entry;
    if (stat?.isDirectory()) return entry.isSymbolicLink() || skipped(entry.name) || file === outputDir ? [] : walk(file);
    return stat?.isFile() && SCRIPT.test(entry.name) ? [scriptAt(scriptsDir, file)] : [];
  });
  if (!statSync(scriptsDir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return walk(scriptsDir).sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
}

function scriptAt(scriptsDir: string, file: string): WorkspaceScript {
  const path = slashes(relative(scriptsDir, file));
  return { name: path.replace(SCRIPT, ""), path, file };
}

/** The workspace and script a path names; throws saying what to change when the path isn't a script of a workspace. */
export function findScript(path: string): { workspace: Workspace; script: WorkspaceScript } {
  const file = resolve(path);
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`${path} doesn't exist`);
  const workspace = findWorkspace(dirname(file));
  if (!SCRIPT.test(file)) {
    throw new Error(`${path} isn't named as a script: rename it to ${file.split(sep).at(-1)!.replace(/\.[^.]+$/, "")}.reel.ts`);
  }
  // Compared as real paths, so a link to the project's folder, such as macOS's /tmp, is the same place.
  if (!existsSync(workspace.scriptsDir) || !isInside(relative(realpathSync(workspace.scriptsDir), realpathSync(file)))) {
    throw new Error(`${path} is outside the scripts folder, ${workspace.config.scripts} in ${join(workspace.root, CONFIG_FILE)}: ` +
      "move it there, or change the folder");
  }
  const scripts = listScripts(workspace);
  const real = realpathSync(file);
  const script = scripts.find((s) => realpathSync(s.file) === real);
  if (!script) throw new Error(`${path} is in a folder that holds no scripts (a dot folder, node_modules, a reel or the output folder)`);
  const twin = scripts.find((s) => s.name === script.name && s.path !== script.path);
  if (twin) throw new Error(`${script.path} and ${twin.path} would give the same reel: rename one`);
  return { workspace, script };
}

/** The folder of a script's reel: `<output>/<name>.reel`, or inside `outDir` when one compose sends it elsewhere. */
export const reelFolder = (workspace: Workspace, script: WorkspaceScript, outDir?: string): string =>
  join(outDir === undefined ? workspace.outputDir : resolve(outDir), `${script.name}.reel`);

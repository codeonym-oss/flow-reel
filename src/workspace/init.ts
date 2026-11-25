// What `flow-reel init` does to a project (GH-108 decision 001): makes a folder a workspace, or takes over the settings
// of a `flow-reel.json` from before 0.8. Asking questions is the command's job.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join, posix, relative, sep } from "node:path";
import type { Brand } from "../composer/cards/brand.ts";
import { CONFIG_FILE, CONFIG_VERSION, type Config, type LegacyConfig, SLUG, folderProblem, readConfig, writeConfig } from "./config.ts";
import { type Workspace, configFolders, skipped, workspaceAt } from "./workspace.ts";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/** A new workspace id: 12 letters and digits, 60 random bits. */
export const newId = (): string => Array.from(randomBytes(12), (byte) => ALPHABET[byte % 32]).join("");

/** A title as lowercase words joined by hyphens, or "" when nothing of it can be one. */
export const slugify = (title: string): string =>
  title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** What a project holds before it is a workspace. */
export interface Survey {
  /** The one `flow-reel.json` from before 0.8 whose settings can be taken over, and its folder relative to the root. */
  legacy?: { file: string; folder: string; config: LegacyConfig };
}


function* filesNamed(dir: string, wanted: (name: string) => boolean): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !skipped(entry.name)) yield* filesNamed(join(dir, entry.name), wanted);
    else if (entry.isFile() && wanted(entry.name)) yield join(dir, entry.name);
  }
}

/** Looks at a project to make it a workspace; throws when it is one already, is inside one, or holds several files. */
export function survey(root: string): Survey {
  const [above] = configFolders(join(root, ".."));
  if (above !== undefined) throw new Error(`${root} is inside the workspace of ${join(above, CONFIG_FILE)}: a workspace has one ${CONFIG_FILE}`);
  const found = [...filesNamed(root, (name) => name === CONFIG_FILE)].map((file) => {
    const folder = join(file, "..");
    return { file, folder, found: readConfig(folder)! };
  });
  const workspace = found.find((f) => f.found.kind === "config");
  if (workspace) {
    throw new Error(workspace.folder === root ? `${root} is already a workspace, ${JSON.stringify((workspace.found.config as Config).workspace.title)}`
      : `${root} holds a workspace already, in ${workspace.folder}: a workspace can't be inside another`);
  }
  if (found.length > 1) {
    throw new Error(`${root} holds several ${CONFIG_FILE} files:\n${found.map((f) => `  ${f.file}`).join("\n")}\n` +
      "A workspace has one. Keep one, with the voice and brand you want, or run `flow-reel init` in each scripts folder's " +
      "own project to make several workspaces");
  }
  const [only] = found;
  return only && only.found.kind === "legacy"
    ? { legacy: { file: only.file, folder: relative(root, only.folder).split(sep).join("/"), config: only.found.config } } : {};
}

export interface InitOptions { title: string; slug?: string; description?: string; scripts?: string; output?: string }

/** The scripts folder `init` proposes: the one that held the settings before, or `reels`. */
export const proposedScripts = ({ legacy }: Survey): string => legacy?.folder || "reels";

/** Writes the project's `flow-reel.json`, with the settings of a file from before 0.8, which it removes. */
export function initialize(root: string, found: Survey, options: InitOptions): Workspace {
  const title = options.title.trim();
  if (!title) throw new Error("a workspace needs a title");
  const slug = options.slug ?? slugify(title);
  if (!SLUG.test(slug)) {
    throw new Error(options.slug === undefined ? `no name can be made from the title ${JSON.stringify(title)}: give one with --slug`
      : `--slug must be lowercase words joined by hyphens, not ${JSON.stringify(slug)}`);
  }
  const scripts = cleanFolder("scripts", options.scripts ?? proposedScripts(found));
  const output = cleanFolder("output", options.output ?? `${scripts}/out`);
  const { legacy } = found;
  const config: Config = { version: CONFIG_VERSION,
    workspace: { id: newId(), slug, title, ...(options.description?.trim() ? { description: options.description.trim() } : {}) },
    scripts, output,
    ...(legacy?.config.integration ? { integration: legacy.config.integration } : {}),
    ...(legacy?.config.voice ? { voice: legacy.config.voice } : {}),
    ...(legacy?.config.brand ? { brand: movedBrand(legacy.config.brand, legacy.folder, scripts) } : {}) };
  writeConfig(root, config);
  // Everything it held is in the new file, and a second one in the workspace would be refused.
  if (legacy?.folder) rmSync(legacy.file);
  mkdirSync(join(root, scripts), { recursive: true });
  return workspaceAt(root, config);
}

function cleanFolder(key: string, value: string): string {
  const problem = folderProblem(key, value);
  if (problem) throw new Error(problem);
  return posix.normalize(value).replace(/\/$/, "");
}

/** The brand with its paths relative to the scripts folder, which they must be in. */
function movedBrand(brand: Brand, from: string, scripts: string): Brand {
  const move = (path: string, key: string) => {
    const moved = posix.relative(scripts, posix.join(from, path));
    if (moved.startsWith("../")) {
      throw new Error(`brand.${key} is ${posix.join(from, path)}, outside the scripts folder ${scripts}, the only one a ` +
        "composer reads: move it there first");
    }
    return moved;
  };
  return { ...brand, ...(brand.logo ? { logo: move(brand.logo, "logo") } : {}),
    ...(brand.fonts ? { fonts: {
      ...(brand.fonts.heading ? { heading: move(brand.fonts.heading, "fonts.heading") } : {}),
      ...(brand.fonts.body ? { body: move(brand.fonts.body, "fonts.body") } : {}),
    } } : {}) };
}

/** Files that import flow-reel but aren't named as scripts, and the name each needs: 0.7 scripts. */
export function scriptsToRename({ root, scriptsDir, outputDir }: Workspace): { from: string; to: string }[] {
  return [...filesNamed(scriptsDir, (name) => /\.[cm]?[tj]s$/.test(name) && !/\.reel\.(ts|js)$/.test(name))]
    .filter((file) => !file.startsWith(outputDir + sep) && /\bexport\s+default\s+script\s*\(/.test(readFileSync(file, "utf8")))
    .map((file) => {
      const name = basename(file).replace(/\.[cm]?([tj]s)$/, ".reel.$1");
      const at = (path: string) => relative(root, path).split(sep).join("/");
      return { from: at(file), to: at(join(file, "..", name)) };
    });
}

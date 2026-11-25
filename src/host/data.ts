// flow-reel's data folder on this computer (epic GH-107 decision 007, GH-108 decision 015), and the workspaces it knows.
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type WorkspaceIdentity, readConfig } from "../workspace/config.ts";
import type { Workspace } from "../workspace/workspace.ts";

type Env = Record<string, string | undefined>;

/** Where the operating system keeps an application's data; `FLOW_REEL_DATA_DIR` overrides it. */
export function dataDir(env: Env = process.env, platform: NodeJS.Platform = process.platform, home: string = homedir()): string {
  if (env.FLOW_REEL_DATA_DIR) return env.FLOW_REEL_DATA_DIR;
  if (platform === "darwin") return join(home, "Library", "Application Support", "flow-reel");
  if (platform === "win32") return join(env.LOCALAPPDATA || join(home, "AppData", "Local"), "flow-reel");
  // The XDG specification ignores a relative path.
  return join(env.XDG_DATA_HOME?.startsWith("/") ? env.XDG_DATA_HOME : join(home, ".local", "share"), "flow-reel");
}

/** What this computer knows about a workspace; its runs are beside this record. */
export interface KnownWorkspace extends WorkspaceIdentity {
  version: 1;
  /** A name used instead of the slug on this computer, when another workspace has the same slug. */
  alias?: string;
  /** Its checkouts' folders. */
  roots: string[];
}

const RECORD = "workspace.json";
export const workspacesDir = (data: string) => join(data, "workspaces");
export const workspaceDir = (data: string, id: string) => join(workspacesDir(data), id);

/** The name commands use for a workspace on this computer. */
export const localSlug = (known: Pick<KnownWorkspace, "slug" | "alias">): string => known.alias ?? known.slug;

function readKnown(data: string, id: string): KnownWorkspace | undefined {
  let text: string;
  try { text = readFileSync(join(workspaceDir(data, id), RECORD), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return JSON.parse(text) as KnownWorkspace;
}

export function knownWorkspaces(data: string): KnownWorkspace[] {
  let ids: string[];
  try { ids = readdirSync(workspacesDir(data)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return ids.sort().flatMap((id) => readKnown(data, id) ?? []);
}

/** Whether a folder still holds the workspace with this id; a project that was removed or moved doesn't. */
function holds(root: string, id: string): boolean {
  try {
    const found = readConfig(root);
    return found?.kind === "config" && found.config.workspace.id === id;
  } catch { return false; }
}

/** The other workspace on this computer that uses `slug`, if one does; one whose folders are all gone doesn't. */
export function slugOwner(data: string, slug: string, id?: string): KnownWorkspace | undefined {
  return knownWorkspaces(data).find((known) =>
    known.id !== id && localSlug(known) === slug && known.roots.some((root) => holds(root, known.id)));
}

export class SlugTakenError extends Error {}

/**
 * Records the workspace on this computer, and returns the record. Two checkouts share an id; another workspace with the
 * same slug is refused until this one has an alias, which the record then keeps.
 */
export function rememberWorkspace(data: string, { root, config }: Workspace, alias?: string): KnownWorkspace {
  const { id, slug, title, description } = config.workspace;
  const before = readKnown(data, id);
  const known: KnownWorkspace = { version: 1, id, slug, title, ...(description ? { description } : {}),
    ...(alias ?? before?.alias ? { alias: alias ?? before?.alias } : {}),
    roots: [root, ...(before?.roots ?? []).filter((other) => other !== root && holds(other, id))] };
  const owner = slugOwner(data, localSlug(known), id);
  if (owner) {
    throw new SlugTakenError(`"${localSlug(known)}" is already the name of ${owner.title} (${owner.roots[0]}) on this computer: ` +
      "give this workspace another one here with `flow-reel init --alias <name>`");
  }
  if (JSON.stringify(known) !== JSON.stringify(before)) {
    const dir = workspaceDir(data, id);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, RECORD);
    writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(known, null, 2)}\n`);
    renameSync(`${file}.${process.pid}`, file);
  }
  return known;
}

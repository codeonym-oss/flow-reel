// `flow-reel.json`, at a workspace's root (GH-108 decisions 001 to 003): who the workspace is, where its scripts and
// reels are, which integration and voice compose them, and its brand. Runs on the host; imports no adapter.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { type Brand, validateBrand } from "../composer/cards/brand.ts";
import { LIMITED, LONGEST, type Limits } from "./limits.ts";
import type { Settings, VoiceSettings } from "../settings.ts";

export const CONFIG_FILE = "flow-reel.json";
export const CONFIG_VERSION = 2;
export const DEFAULT_SCRIPTS = "reels";

/** Who a workspace is: `id` never changes and is shared by its checkouts; `slug` is how commands name it. */
export interface WorkspaceIdentity { id: string; slug: string; title: string; description?: string }

/** The integration and voice a config can set; both are optional. */
export interface ConfiguredSettings { integration?: string; voice?: Partial<VoiceSettings> }

export interface Config extends ConfiguredSettings {
  version: typeof CONFIG_VERSION;
  workspace: WorkspaceIdentity;
  /** The scripts folder, relative to the root, with forward slashes. */
  scripts: string;
  /** Where reels go, relative to the root, with forward slashes. */
  output: string;
  brand?: Brand;
  /** How many minutes a phase may take. */
  limits?: Partial<Limits>;
  /** How many finished runs of each script keep their heavy files. */
  keepRuns?: number;
}

/** A `flow-reel.json` from before 0.8: it sat beside the scripts and had no workspace. */
export interface LegacyConfig extends ConfiguredSettings { version: 1; brand?: Brand }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function unknownKey(where: string, value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  const key = Object.keys(value).find((k) => !keys.includes(k));
  return key === undefined ? undefined : `${where}unknown key ${JSON.stringify(key)}; it takes ${keys.join(", ")}`;
}

const VOICE_KEYS = ["adapter", "speaker", "language", "model", "apiKeyEnv", "baseUrl"] as const;

function validateSettings(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (value.integration !== undefined && typeof value.integration !== "string") errors.push("integration must be a string");
  if (value.voice !== undefined) {
    if (!isObject(value.voice)) errors.push("voice must be an object");
    else {
      if ("apiKey" in value.voice) {
        errors.push("voice.apiKey: keys don't go in flow-reel.json; put the key in an environment variable and name it " +
          'with "apiKeyEnv"');
      }
      const extra = unknownKey("voice: ", Object.fromEntries(Object.entries(value.voice).filter(([k]) => k !== "apiKey")), VOICE_KEYS);
      if (extra) errors.push(extra);
      for (const key of VOICE_KEYS) {
        if (value.voice[key] !== undefined && typeof value.voice[key] !== "string") errors.push(`voice.${key} must be a string`);
      }
    }
  }
  if (value.brand !== undefined) errors.push(...validateBrand(value.brand));
  return errors;
}

export const ID = /^[a-z0-9]{12}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The problem with a folder named in the config, or undefined. */
export function folderProblem(key: string, value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return `${key} must be a folder's path, relative to ${CONFIG_FILE}`;
  if (value.includes("\\")) return `${key} must use forward slashes`;
  if (posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) return `${key} must be relative to ${CONFIG_FILE}, not absolute`;
  const path = posix.normalize(value).replace(/\/$/, "");
  if (path === "." || path === ".." || path.startsWith("../")) return `${key} must be a folder inside the workspace, not ${value}`;
  return undefined;
}

export function validateConfig(value: unknown): string[] {
  if (!isObject(value)) return ["must be a JSON object"];
  const errors: string[] = [];
  const extra = unknownKey("", value, ["version", "workspace", "scripts", "output", "integration", "voice", "brand", "limits", "keepRuns"]);
  if (extra) errors.push(extra);
  if (value.version !== CONFIG_VERSION) errors.push(`version must be ${CONFIG_VERSION}`);
  if (!isObject(value.workspace)) errors.push("workspace must be an object");
  else {
    const { id, slug, title, description } = value.workspace;
    const extraKey = unknownKey("workspace: ", value.workspace, ["id", "slug", "title", "description"]);
    if (extraKey) errors.push(extraKey);
    if (typeof id !== "string" || !ID.test(id)) errors.push("workspace.id must be the 12 letters and digits `flow-reel init` wrote");
    if (typeof slug !== "string" || !SLUG.test(slug)) errors.push("workspace.slug must be lowercase words joined by hyphens");
    if (typeof title !== "string" || !title.trim()) errors.push("workspace.title must be text");
    if (description !== undefined && typeof description !== "string") errors.push("workspace.description must be text");
  }
  const folders = (["scripts", "output"] as const).map((key) => folderProblem(key, value[key]));
  errors.push(...folders.filter((problem) => problem !== undefined));
  if (!folders.some(Boolean)) {
    const [scripts, output] = [value.scripts, value.output].map((path) => posix.normalize(`${path as string}/`));
    if (scripts.startsWith(output)) errors.push("output must not be the scripts folder or hold it; it can be inside it");
  }
  return [...errors, ...validateLimits(value.limits), ...validateKeepRuns(value.keepRuns), ...validateSettings(value)];
}

function validateLimits(value: unknown): string[] {
  if (value === undefined) return [];
  if (!isObject(value)) return ["limits must be an object"];
  const extra = unknownKey("limits: ", value, LIMITED);
  return [...(extra ? [extra] : []), ...LIMITED.filter((phase) => value[phase] !== undefined && !(typeof value[phase] === "number" && value[phase] > 0 && value[phase] <= LONGEST))
    .map((phase) => `limits.${phase} must be a number of minutes, more than 0 and at most ${LONGEST}`)];
}

const validateKeepRuns = (value: unknown): string[] =>
  value === undefined || (Number.isInteger(value) && (value as number) >= 1) ? [] : ["keepRuns must be a whole number, at least 1"];

/** A config file as found: today's, or one from before 0.8, whose settings `init` takes over. */
export type FoundConfig = { kind: "config"; config: Config } | { kind: "legacy"; config: LegacyConfig };

/** The `flow-reel.json` of `dir`, or undefined when there is none; throws naming what is wrong with it. */
export function readConfig(dir: string): FoundConfig | undefined {
  const file = join(dir, CONFIG_FILE);
  let text: string;
  try { text = readFileSync(file, "utf8"); }
  catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return undefined;
    throw error;
  }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`${file}: ${(error as Error).message}`); }
  const legacy = isObject(value) && value.version === 1;
  const errors = legacy ? validateLegacy(value as Record<string, unknown>) : validateConfig(value);
  if (errors.length) throw new Error(`${file}: ${errors.join("; ")}`);
  return legacy ? { kind: "legacy", config: value as LegacyConfig } : { kind: "config", config: value as Config };
}

function validateLegacy(value: Record<string, unknown>): string[] {
  const extra = unknownKey("", value, ["version", "integration", "voice", "brand"]);
  return [...(extra ? [extra] : []), ...validateSettings(value)];
}

/** Replaces `dir`'s `flow-reel.json` in one step. */
export function writeConfig(dir: string, config: Config): void {
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`${CONFIG_FILE}: ${errors.join("; ")}`);
  const file = join(dir, CONFIG_FILE);
  writeFileSync(`${file}.tmp`, `${JSON.stringify(config, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
}

/** The config with these settings, everything else kept. */
export const withSettings = (config: Config, settings: Settings): Config =>
  ({ ...config, integration: settings.integration, voice: { ...settings.voice } });

// The composer's configuration (GH-33 decisions 001, 003 and 004): which integration and voice compose a script, from
// flags over `flow-reel.json` over the defaults. Runs on the host as well as in the composer, so it imports no adapter.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "flow-reel.json";

export interface VoiceSettings { adapter: string; speaker: string; language: string }
export interface Settings { integration: string; voice: VoiceSettings }
/** What flags can set; each overrides the file. */
export interface SettingsFlags { integration?: string; voice?: string; speaker?: string; language?: string }
/** `flow-reel.json`: every setting is optional. */
export interface ConfigFile { version: 1; integration?: string; voice?: Partial<VoiceSettings> }

/** What one adapter can be set to, and the environment variables it needs, by name. */
export interface Known {
  integrations: Record<string, { credentials: string[] }>;
  voices: Record<string, { speakers: string[]; languages: string[]; speaker: string; language: string; credentials: string[] }>;
  defaults: { integration: string; voice: string };
}

// The shipped model's own lists (Qwen3-TTS 0.6B CustomVoice, revision 85e237c).
export const KNOWN: Known = {
  integrations: { playwright: { credentials: [] } },
  voices: {
    "qwen3-tts-0.6b": {
      speakers: ["Aiden", "Dylan", "Eric", "Ono_Anna", "Ryan", "Serena", "Sohee", "Uncle_Fu", "Vivian"],
      languages: ["chinese", "english", "french", "german", "italian", "japanese", "korean", "portuguese", "russian",
        "spanish"],
      speaker: "Ryan", language: "english", credentials: [],
    },
  },
  defaults: { integration: "playwright", voice: "qwen3-tts-0.6b" },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function unknownKey(where: string, value: Record<string, unknown>, keys: string[]): string | undefined {
  const key = Object.keys(value).find((k) => !keys.includes(k));
  return key === undefined ? undefined : `${where}unknown key ${JSON.stringify(key)}; it takes ${keys.join(", ")}`;
}

export function validateConfig(value: unknown): string[] {
  if (!isObject(value)) return ["must be a JSON object"];
  const errors: string[] = [];
  const extra = unknownKey("", value, ["version", "integration", "voice"]);
  if (extra) errors.push(extra);
  if (value.version !== 1) errors.push("version must be 1");
  if (value.integration !== undefined && typeof value.integration !== "string") errors.push("integration must be a string");
  if (value.voice !== undefined) {
    if (!isObject(value.voice)) errors.push("voice must be an object");
    else {
      const extraVoice = unknownKey("voice: ", value.voice, ["adapter", "speaker", "language"]);
      if (extraVoice) errors.push(extraVoice);
      for (const key of ["adapter", "speaker", "language"]) {
        if (value.voice[key] !== undefined && typeof value.voice[key] !== "string") errors.push(`voice.${key} must be a string`);
      }
    }
  }
  return errors;
}

/** The script folder's `flow-reel.json`, or undefined when there is none. */
export function readConfig(dir: string): ConfigFile | undefined {
  const file = join(dir, CONFIG_FILE);
  let text: string;
  try { text = readFileSync(file, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`${CONFIG_FILE}: ${(error as Error).message}`); }
  const errors = validateConfig(value);
  if (errors.length) throw new Error(`${CONFIG_FILE}: ${errors.join("; ")}`);
  return value as ConfigFile;
}

export function writeConfig(dir: string, settings: Settings): void {
  const config: ConfigFile = { version: 1, integration: settings.integration, voice: { ...settings.voice } };
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

const choose = (what: string, value: string, known: readonly string[]) => {
  if (!known.includes(value)) throw new Error(`unknown ${what} ${JSON.stringify(value)}; known ${what}s: ${known.join(", ")}`);
  return value;
};

/**
 * Flag over file over default, checked against what is known. A voice chosen by flag that differs from the file's
 * leaves the file's speaker and language out, since they belong to the other voice.
 */
export function resolveSettings(file: ConfigFile | undefined, flags: SettingsFlags = {}, known: Known = KNOWN): Settings {
  const integration = choose("integration", flags.integration ?? file?.integration ?? known.defaults.integration,
    Object.keys(known.integrations));
  const fileVoice = file?.voice ?? {};
  const adapter = choose("voice", flags.voice ?? fileVoice.adapter ?? known.defaults.voice, Object.keys(known.voices));
  const fromFile = (fileVoice.adapter ?? known.defaults.voice) === adapter ? fileVoice : {};
  const voice = known.voices[adapter];
  return {
    integration,
    voice: {
      adapter,
      speaker: choose("speaker", flags.speaker ?? fromFile.speaker ?? voice.speaker, voice.speakers),
      language: choose("language", flags.language ?? fromFile.language ?? voice.language, voice.languages),
    },
  };
}

/** The environment variables the chosen adapters need; throws naming the first one that isn't set. */
export function credentialsFor(settings: Settings, env: NodeJS.ProcessEnv, known: Known = KNOWN): string[] {
  const needs = [
    ...known.integrations[settings.integration].credentials.map((name) => [`integration ${settings.integration}`, name]),
    ...known.voices[settings.voice.adapter].credentials.map((name) => [`voice ${settings.voice.adapter}`, name]),
  ];
  const missing = needs.find(([, name]) => !env[name]);
  if (missing) throw new Error(`${missing[0]} needs ${missing[1]}: set it in the environment and compose again`);
  return needs.map(([, name]) => name);
}

/** The settings as `compose` flags, for the composer in the container. */
export const settingsFlags = ({ integration, voice }: Settings): string[] =>
  ["--integration", integration, "--voice", voice.adapter, "--speaker", voice.speaker, "--language", voice.language];

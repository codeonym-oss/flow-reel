// The composer's configuration (GH-33 decisions 001, 003 and 004; cloud voices, GH-49): which integration and voice
// compose a script, from flags over `flow-reel.json` over the defaults. Runs on the host as well as in the composer, so
// it imports no adapter.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "flow-reel.json";

export interface VoiceSettings {
  adapter: string; speaker: string; language: string;
  /** A cloud voice's model, its API key's environment variable and its endpoint (GH-49 decisions 001 and 003). */
  model?: string; apiKeyEnv?: string; baseUrl?: string;
}
export interface Settings { integration: string; voice: VoiceSettings }
/** What flags can set; each overrides the file. */
export interface SettingsFlags {
  integration?: string; voice?: string; speaker?: string; language?: string; model?: string; apiKeyEnv?: string;
  baseUrl?: string;
}
/** `flow-reel.json`: every setting is optional. */
export interface ConfigFile { version: 1; integration?: string; voice?: Partial<VoiceSettings> }

/**
 * What one voice can be set to. A local voice lists its speakers and languages and needs no key; a cloud voice passes
 * any speaker and language on to its provider, whose lists change, and reads its key from an environment variable.
 */
export interface KnownVoice {
  speaker: string; language: string;
  speakers?: string[]; languages?: string[];
  credentials: string[];
  cloud?: {
    /** The default model; none means the file or a flag must name one. */
    model?: string;
    /** The default environment variable holding the API key; none means the server may need no key. */
    apiKeyEnv?: string;
    /** The default endpoint root; none means the file or a flag must give `baseUrl`. */
    baseUrl?: string;
  };
}

/** What one adapter can be set to, and the environment variables it needs, by name. */
export interface Known {
  integrations: Record<string, { credentials: string[] }>;
  voices: Record<string, KnownVoice>;
  defaults: { integration: string; voice: string };
}

// The cloud voices (GH-49 decision 002). "auto" lets the provider detect the language from the text.
const cloud = (speaker: string, defaults: NonNullable<KnownVoice["cloud"]>): KnownVoice =>
  ({ speaker, language: "auto", credentials: [], cloud: defaults });

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
    openai: cloud("coral", { model: "gpt-4o-mini-tts", apiKeyEnv: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" }),
    gemini: cloud("Kore", { model: "gemini-3.8-flash-tts", apiKeyEnv: "GEMINI_API_KEY",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta" }),
    openrouter: cloud("Kore", { model: "google/gemini-3.8-flash-tts", apiKeyEnv: "OPENROUTER_API_KEY",
      baseUrl: "https://openrouter.ai/api/v1" }),
    together: cloud("tara", { model: "canopylabs/orpheus-3b-0.1-ft", apiKeyEnv: "TOGETHER_API_KEY",
      baseUrl: "https://api.together.ai/v1" }),
    groq: cloud("troy", { model: "canopylabs/orpheus-v1-english", apiKeyEnv: "GROQ_API_KEY",
      baseUrl: "https://api.groq.com/openai/v1" }),
    elevenlabs: cloud("JBFqnCBsd6RMkjVDRZzb", { model: "eleven_multilingual_v2", apiKeyEnv: "ELEVENLABS_API_KEY",
      baseUrl: "https://api.elevenlabs.io/v1" }),
    "openai-compatible": cloud("alloy", {}),
  },
  defaults: { integration: "playwright", voice: "qwen3-tts-0.6b" },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function unknownKey(where: string, value: Record<string, unknown>, keys: string[]): string | undefined {
  const key = Object.keys(value).find((k) => !keys.includes(k));
  return key === undefined ? undefined : `${where}unknown key ${JSON.stringify(key)}; it takes ${keys.join(", ")}`;
}

const VOICE_KEYS = ["adapter", "speaker", "language", "model", "apiKeyEnv", "baseUrl"] as const;

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
      if ("apiKey" in value.voice) {
        errors.push("voice.apiKey: keys don't go in flow-reel.json; put the key in an environment variable and name it " +
          'with "apiKeyEnv"');
      }
      const extraVoice = unknownKey("voice: ", Object.fromEntries(Object.entries(value.voice).filter(([k]) => k !== "apiKey")),
        [...VOICE_KEYS]);
      if (extraVoice) errors.push(extraVoice);
      for (const key of VOICE_KEYS) {
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

const choose = (what: string, value: string, known: readonly string[] | undefined) => {
  if (known && !known.includes(value)) throw new Error(`unknown ${what} ${JSON.stringify(value)}; known ${what}s: ${known.join(", ")}`);
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
  const chosen: VoiceSettings = {
    adapter,
    speaker: choose("speaker", flags.speaker ?? fromFile.speaker ?? voice.speaker, voice.speakers),
    language: choose("language", flags.language ?? fromFile.language ?? voice.language, voice.languages),
  };
  for (const [key, flag] of [["model", "--model"], ["apiKeyEnv", "--api-key-env"], ["baseUrl", "--base-url"]] as const) {
    const value = flags[key] ?? fromFile[key] ?? voice.cloud?.[key];
    if (value === undefined) continue;
    if (!voice.cloud) throw new Error(`voice ${adapter} runs locally and takes no ${key} (${flag})`);
    chosen[key] = value;
  }
  if (voice.cloud) {
    if (!chosen.model) throw new Error(`voice ${adapter} needs a model: set voice.model in ${CONFIG_FILE} or --model`);
    if (!chosen.baseUrl) throw new Error(`voice ${adapter} needs a server: set voice.baseUrl in ${CONFIG_FILE} or --base-url`);
    if (!/^https?:\/\//.test(chosen.baseUrl)) throw new Error(`voice.baseUrl must start with http:// or https://`);
    if (chosen.apiKeyEnv !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(chosen.apiKeyEnv)) {
      throw new Error(`voice.apiKeyEnv must name an environment variable, such as OPENAI_API_KEY, not hold the key`);
    }
  }
  return { integration, voice: chosen };
}

/** The environment variables the chosen adapters need; throws naming the first one that isn't set. */
export function credentialsFor(settings: Settings, env: NodeJS.ProcessEnv, known: Known = KNOWN): string[] {
  const needs = [
    ...known.integrations[settings.integration].credentials.map((name) => [`integration ${settings.integration}`, name]),
    ...[...known.voices[settings.voice.adapter].credentials, ...(settings.voice.apiKeyEnv ? [settings.voice.apiKeyEnv] : [])]
      .map((name) => [`voice ${settings.voice.adapter}`, name]),
  ];
  const missing = needs.find(([, name]) => !env[name]);
  if (missing) throw new Error(`${missing[0]} needs ${missing[1]}: set it in the environment and compose again`);
  return needs.map(([, name]) => name);
}

/** The settings as `compose` flags, for the composer in the container. */
export const settingsFlags = ({ integration, voice }: Settings): string[] => [
  "--integration", integration, "--voice", voice.adapter, "--speaker", voice.speaker, "--language", voice.language,
  ...(voice.model ? ["--model", voice.model] : []), ...(voice.apiKeyEnv ? ["--api-key-env", voice.apiKeyEnv] : []),
  ...(voice.baseUrl ? ["--base-url", voice.baseUrl] : []),
];

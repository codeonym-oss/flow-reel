import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRunArgs, saveSettings } from "../../src/host/launch.ts";
import { KNOWN, type Known, credentialsFor, readConfig, resolveSettings, validateConfig, writeConfig } from "../../src/settings.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-settings-"));
  dirs.push(dir);
  return dir;
};

const DEFAULTS = { integration: "playwright", voice: { adapter: "qwen3-tts-0.6b", speaker: "Ryan", language: "english" } };
// A cloud voice as it would be added: another adapter that declares its credential.
const known: Known = { ...KNOWN, voices: { ...KNOWN.voices,
  "cloud-fake": { speakers: ["Nova"], languages: ["english"], speaker: "Nova", language: "english", credentials: ["FAKE_TOKEN"] } } };

it("uses the defaults when nothing is set", () => {
  expect(resolveSettings(undefined)).toEqual(DEFAULTS);
  expect(resolveSettings({ version: 1 })).toEqual(DEFAULTS);
});

it("takes a flag over the file over the default (GH-33 decision 001)", () => {
  const file = { version: 1 as const, voice: { speaker: "Aiden", language: "french" } };
  expect(resolveSettings(file).voice).toEqual({ adapter: "qwen3-tts-0.6b", speaker: "Aiden", language: "french" });
  expect(resolveSettings(file, { speaker: "Serena" }).voice).toEqual({ adapter: "qwen3-tts-0.6b", speaker: "Serena", language: "french" });
  expect(resolveSettings(undefined, { language: "german" }).voice).toEqual({ adapter: "qwen3-tts-0.6b", speaker: "Ryan", language: "german" });
});

it("leaves the file's speaker and language out when a flag picks another voice", () => {
  const file = { version: 1 as const, voice: { adapter: "qwen3-tts-0.6b", speaker: "Aiden" } };
  expect(resolveSettings(file, { voice: "cloud-fake" }, known).voice).toEqual({ adapter: "cloud-fake", speaker: "Nova", language: "english" });
});

it("names the known values when one is unknown", () => {
  expect(() => resolveSettings(undefined, { integration: "cypress" })).toThrow('unknown integration "cypress"; known integrations: playwright');
  expect(() => resolveSettings(undefined, { voice: "x" })).toThrow('unknown voice "x"; known voices: qwen3-tts-0.6b');
  expect(() => resolveSettings({ version: 1, voice: { speaker: "ryan" } })).toThrow(
    'unknown speaker "ryan"; known speakers: Aiden, Dylan, Eric, Ono_Anna, Ryan, Serena, Sohee, Uncle_Fu, Vivian');
  expect(() => resolveSettings(undefined, { language: "English" })).toThrow('unknown language "English"; known languages: chinese,');
});

it("checks flow-reel.json", () => {
  expect(validateConfig({ version: 1, integration: "playwright", voice: { adapter: "a", speaker: "b", language: "c" } })).toEqual([]);
  expect(validateConfig([])).toEqual(["must be a JSON object"]);
  expect(validateConfig({ version: 2 })).toEqual(["version must be 1"]);
  expect(validateConfig({ version: 1, env: ["KEY"] })).toEqual(['unknown key "env"; it takes version, integration, voice']);
  expect(validateConfig({ version: 1, voice: { seed: 1 } })).toEqual(['voice: unknown key "seed"; it takes adapter, speaker, language, model, apiKeyEnv, baseUrl']);
  expect(validateConfig({ version: 1, integration: 1, voice: { speaker: 2 } }))
    .toEqual(["integration must be a string", "voice.speaker must be a string"]);
  const dir = folder();
  expect(readConfig(dir)).toBeUndefined();
  writeFileSync(join(dir, "flow-reel.json"), "{ version: 1 }");
  expect(() => readConfig(dir)).toThrow(/^flow-reel\.json: /);
  writeFileSync(join(dir, "flow-reel.json"), '{ "version": 1, "voice": [] }');
  expect(() => readConfig(dir)).toThrow("flow-reel.json: voice must be an object");
});

it("writes the file after a successful compose only, when there is none or with --save-config (decisions 001, 005)", () => {
  const dir = folder();
  expect(saveSettings(1, dir, DEFAULTS, true)).toBe(false);
  expect(readdirSync(dir)).toEqual([]);
  expect(saveSettings(0, dir, DEFAULTS, false)).toBe(false);
  expect(existsSync(join(dir, "flow-reel.json"))).toBe(false);
  expect(saveSettings(0, dir, DEFAULTS, true)).toBe(true);
  expect(readFileSync(join(dir, "flow-reel.json"), "utf8")).toBe(`${JSON.stringify({ version: 1, ...DEFAULTS }, null, 2)}\n`);
  expect(readConfig(dir)).toEqual({ version: 1, ...DEFAULTS });
});

it("needs each credential an adapter declares, and keeps its value out of everything written (decision 004)", () => {
  expect(credentialsFor(DEFAULTS, {})).toEqual([]);
  const settings = resolveSettings(undefined, { voice: "cloud-fake" }, known);
  expect(() => credentialsFor(settings, {}, known)).toThrow("voice cloud-fake needs FAKE_TOKEN: set it in the environment");
  const secret = "s3cret-value-of-the-token";
  const credentials = credentialsFor(settings, { FAKE_TOKEN: secret }, known);
  expect(credentials).toEqual(["FAKE_TOKEN"]);
  const args = buildRunArgs({ engine: "docker", desktop: false, image: "image", workDir: "/w", script: "demo.ts", uid: 1, gid: 1,
    settings, credentials });
  const dir = folder();
  writeConfig(dir, settings);
  // What the transcript and the manifest record about the voice: its settings, never its credentials.
  const voiceRecord = { adapter: settings.voice.adapter, voice: settings.voice.speaker, seed: 0, language: settings.voice.language };
  for (const written of [args.join(" "), readFileSync(join(dir, "flow-reel.json"), "utf8"), JSON.stringify(voiceRecord)]) {
    expect(written).not.toContain(secret);
  }
});

describe("cloud voices (GH-49)", () => {
  it("fills in the provider's model, speaker, key variable and server", () => {
    expect(resolveSettings({ version: 1, voice: { adapter: "openai" } }).voice).toEqual({ adapter: "openai", speaker: "coral",
      language: "auto", model: "gpt-4o-mini-tts", apiKeyEnv: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" });
    expect(resolveSettings(undefined, { voice: "gemini", model: "gemini-3.8-flash-lite-tts", speaker: "Puck" }).voice)
      .toMatchObject({ adapter: "gemini", model: "gemini-3.8-flash-lite-tts", speaker: "Puck", apiKeyEnv: "GEMINI_API_KEY" });
  });

  it("passes any speaker and language on, since the provider's lists change", () => {
    expect(resolveSettings(undefined, { voice: "elevenlabs", speaker: "a-voice-id", language: "fr" }).voice)
      .toMatchObject({ speaker: "a-voice-id", language: "fr" });
  });

  it("takes the key's variable from the file or a flag, and refuses a key in the file", () => {
    const file = { version: 1 as const, voice: { adapter: "groq", apiKeyEnv: "MY_GROQ_KEY" } };
    expect(resolveSettings(file).voice.apiKeyEnv).toBe("MY_GROQ_KEY");
    expect(resolveSettings(file, { apiKeyEnv: "OTHER" }).voice.apiKeyEnv).toBe("OTHER");
    expect(() => resolveSettings(file, { apiKeyEnv: "sk-abc123-def" })).toThrow("voice.apiKeyEnv must name an environment variable");
    expect(validateConfig({ version: 1, voice: { adapter: "openai", apiKey: "sk-123" } })).toEqual([
      'voice.apiKey: keys don\'t go in flow-reel.json; put the key in an environment variable and name it with "apiKeyEnv"']);
  });

  it("needs a model and a server for an OpenAI-compatible server, and no key unless named", () => {
    expect(() => resolveSettings(undefined, { voice: "openai-compatible" })).toThrow("voice openai-compatible needs a model");
    expect(() => resolveSettings(undefined, { voice: "openai-compatible", model: "kokoro" }))
      .toThrow("voice openai-compatible needs a server: set voice.baseUrl");
    const settings = resolveSettings(undefined, { voice: "openai-compatible", model: "kokoro", baseUrl: "http://localhost:8880/v1" });
    expect(credentialsFor(settings, {})).toEqual([]);
    expect(() => resolveSettings(undefined, { voice: "openai", baseUrl: "api.openai.com" })).toThrow("must start with http");
  });

  it("refuses cloud settings for the local voice", () => {
    expect(() => resolveSettings(undefined, { model: "x" })).toThrow("voice qwen3-tts-0.6b runs locally and takes no model (--model)");
  });

  it("needs the key's variable set, passes it by name, and writes no key anywhere", () => {
    const settings = resolveSettings(undefined, { voice: "openai" });
    expect(() => credentialsFor(settings, {})).toThrow("voice openai needs OPENAI_API_KEY: set it in the environment");
    const secret = "sk-live-secret-value";
    expect(credentialsFor(settings, { OPENAI_API_KEY: secret })).toEqual(["OPENAI_API_KEY"]);
    const args = buildRunArgs({ engine: "docker", desktop: false, image: "image", workDir: "/w", script: "demo.ts", uid: 1, gid: 1,
      settings, credentials: ["OPENAI_API_KEY"] });
    expect(args.slice(-6)).toEqual(["--model", "gpt-4o-mini-tts", "--api-key-env", "OPENAI_API_KEY", "--base-url",
      "https://api.openai.com/v1"]);
    const dir = folder();
    writeConfig(dir, settings);
    expect(readConfig(dir)).toEqual({ version: 1, ...settings });
    for (const written of [args.join(" "), readFileSync(join(dir, "flow-reel.json"), "utf8")]) expect(written).not.toContain(secret);
  });
});

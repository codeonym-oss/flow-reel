import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { containerArgs } from "../../src/host/container.ts";
import { KNOWN, type Known, type Settings, credentialsFor, resolveSettings } from "../../src/settings.ts";
import { type Config, validateConfig, withSettings, writeConfig } from "../../src/workspace/config.ts";

const dirs: string[] = [];
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-settings-"));
  dirs.push(dir);
  return dir;
};

const config: Config = { version: 2, workspace: { id: "abcdefghijkl", slug: "shop", title: "Shop" }, scripts: "reels", output: "reels/out" };
/** The arguments that compose with these settings, which the engine's command line shows. */
const runArgs = (settings: Settings, credentials: string[]) => containerArgs({ engine: { command: "docker", kind: "docker", desktop: false },
  image: "image", name: "flow-reel", runDir: "/run", out: "/run/out", uid: 1, gid: 1, credentials, request: { phase: "voice", voice: KNOWN.voices[settings.voice.adapter] ? settings.voice : DEFAULTS.voice } });
const DEFAULTS = { integration: "playwright", voice: { adapter: "qwen3-tts-0.6b", speaker: "Ryan", language: "english" } };
// A cloud voice as it would be added: another adapter that declares its credential.
const known: Known = { ...KNOWN, voices: { ...KNOWN.voices,
  "cloud-fake": { speakers: ["Nova"], languages: ["english"], speaker: "Nova", language: "english", credentials: ["FAKE_TOKEN"] } } };

it("uses the defaults when nothing is set", () => {
  expect(resolveSettings(undefined)).toEqual(DEFAULTS);
  expect(resolveSettings({})).toEqual(DEFAULTS);
});

it("takes a flag over the file over the default (GH-33 decision 001)", () => {
  const file = { voice: { speaker: "Aiden", language: "french" } };
  expect(resolveSettings(file).voice).toEqual({ adapter: "qwen3-tts-0.6b", speaker: "Aiden", language: "french" });
  expect(resolveSettings(file, { speaker: "Serena" }).voice).toEqual({ adapter: "qwen3-tts-0.6b", speaker: "Serena", language: "french" });
  expect(resolveSettings(undefined, { language: "german" }).voice).toEqual({ adapter: "qwen3-tts-0.6b", speaker: "Ryan", language: "german" });
});

it("leaves the file's speaker and language out when a flag picks another voice", () => {
  const file = { voice: { adapter: "qwen3-tts-0.6b", speaker: "Aiden" } };
  expect(resolveSettings(file, { voice: "cloud-fake" }, known).voice).toEqual({ adapter: "cloud-fake", speaker: "Nova", language: "english" });
});

it("names the known values when one is unknown", () => {
  expect(() => resolveSettings(undefined, { integration: "cypress" })).toThrow('unknown integration "cypress"; known integrations: playwright');
  expect(() => resolveSettings(undefined, { voice: "x" })).toThrow('unknown voice "x"; known voices: qwen3-tts-0.6b');
  expect(() => resolveSettings({ voice: { speaker: "ryan" } })).toThrow(
    'unknown speaker "ryan"; known speakers: Aiden, Dylan, Eric, Ono_Anna, Ryan, Serena, Sohee, Uncle_Fu, Vivian');
  expect(() => resolveSettings(undefined, { language: "English" })).toThrow('unknown language "English"; known languages: chinese,');
});

it("saves the settings in the config, and keeps the rest of it", () => {
  const dir = folder();
  writeConfig(dir, withSettings({ ...config, brand: { theme: "ocean" } }, DEFAULTS));
  expect(JSON.parse(readFileSync(join(dir, "flow-reel.json"), "utf8"))).toEqual({ ...config, brand: { theme: "ocean" }, ...DEFAULTS });
});

it("needs each credential an adapter declares, and keeps its value out of everything written (decision 004)", () => {
  expect(credentialsFor(DEFAULTS, {})).toEqual([]);
  const settings = resolveSettings(undefined, { voice: "cloud-fake" }, known);
  expect(() => credentialsFor(settings, {}, known)).toThrow("voice cloud-fake needs FAKE_TOKEN: set it in the environment");
  const secret = "s3cret-value-of-the-token";
  const credentials = credentialsFor(settings, { FAKE_TOKEN: secret }, known);
  expect(credentials).toEqual(["FAKE_TOKEN"]);
  const args = runArgs(settings, credentials);
  const dir = folder();
  writeConfig(dir, withSettings(config, settings));
  // What the transcript and the manifest record about the voice: its settings, never its credentials.
  const voiceRecord = { adapter: settings.voice.adapter, voice: settings.voice.speaker, seed: 0, language: settings.voice.language };
  for (const written of [args.join(" "), readFileSync(join(dir, "flow-reel.json"), "utf8"), JSON.stringify(voiceRecord)]) {
    expect(written).not.toContain(secret);
  }
});

describe("cloud voices (GH-49)", () => {
  it("fills in the provider's model, speaker, key variable and server", () => {
    expect(resolveSettings({ voice: { adapter: "openai" } }).voice).toEqual({ adapter: "openai", speaker: "coral",
      language: "auto", model: "gpt-4o-mini-tts", apiKeyEnv: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" });
    expect(resolveSettings(undefined, { voice: "gemini", model: "gemini-3.8-flash-lite-tts", speaker: "Puck" }).voice)
      .toMatchObject({ adapter: "gemini", model: "gemini-3.8-flash-lite-tts", speaker: "Puck", apiKeyEnv: "GEMINI_API_KEY" });
  });

  it("passes any speaker and language on, since the provider's lists change", () => {
    expect(resolveSettings(undefined, { voice: "elevenlabs", speaker: "a-voice-id", language: "fr" }).voice)
      .toMatchObject({ speaker: "a-voice-id", language: "fr" });
  });

  it("takes the key's variable from the file or a flag, and refuses a key in the file", () => {
    const file = { voice: { adapter: "groq", apiKeyEnv: "MY_GROQ_KEY" } };
    expect(resolveSettings(file).voice.apiKeyEnv).toBe("MY_GROQ_KEY");
    expect(resolveSettings(file, { apiKeyEnv: "OTHER" }).voice.apiKeyEnv).toBe("OTHER");
    expect(() => resolveSettings(file, { apiKeyEnv: "sk-abc123-def" })).toThrow("voice.apiKeyEnv must name an environment variable");
    expect(validateConfig({ ...config, voice: { adapter: "openai", apiKey: "sk-123" } })).toEqual([
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
    const args = runArgs(settings, ["OPENAI_API_KEY"]);
    expect(args.slice(args.indexOf("-e"), args.indexOf("-e") + 2)).toEqual(["-e", "OPENAI_API_KEY"]);
    const dir = folder();
    writeConfig(dir, withSettings(config, settings));
    for (const written of [args.join(" "), readFileSync(join(dir, "flow-reel.json"), "utf8")]) expect(written).not.toContain(secret);
  });
});

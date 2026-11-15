// Cloud voices (GH-49) against a local server that answers like each provider: the request each one sends, the WAV
// the composer gets back, retries, and errors that name the key's variable but never the key.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { cloudVoice } from "../../src/adapters/cloud/voice.ts";
import { resolveSettings } from "../../src/settings.ts";

const KEY = "sk-test-not-a-real-key-0123456789";
const pcm = (ms: number, rate = 24000) => {
  const samples = Math.round((rate * ms) / 1000);
  const buffer = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate)), i * 2);
  return buffer;
};
const wav = (ms: number, rate = 22050) => {
  const data = pcm(ms, rate);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

interface Seen { method: string; url: string; headers: IncomingMessage["headers"]; body: Record<string, unknown> }
let seen: Seen[] = [];
let answer: (seen: Seen, res: ServerResponse) => void = () => {};
const server = createServer((req, res) => {
  let text = "";
  req.on("data", (chunk) => { text += chunk; });
  req.on("end", () => {
    const request = { method: req.method!, url: req.url!, headers: req.headers, body: JSON.parse(text || "{}") };
    seen.push(request);
    answer(request, res);
  });
});
let base = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const dirs: string[] = [];
afterEach(() => { seen = []; dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });
const folder = () => { const dir = mkdtempSync(join(tmpdir(), "flow-reel-cloud-")); dirs.push(dir); return dir; };

const probe = (file: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
  "stream=codec_name,channels,sample_rate,duration", "-of", "json", file], { encoding: "utf8" })).streams[0];

/** The settings for `adapter` pointed at the local server, with the key in the environment. */
const voiceFor = (adapter: string, extra: Record<string, string> = {}) => {
  const { voice } = resolveSettings({ version: 1, voice: { adapter, baseUrl: base, ...extra } });
  return cloudVoice(voice, { env: { [voice.apiKeyEnv ?? "NONE"]: KEY }, backoffMs: 1 });
};

it.each([
  ["openai", "/v1/audio/speech", { authorization: `Bearer ${KEY}` },
    { model: "gpt-4o-mini-tts", input: "Hello there.", voice: "coral", response_format: "pcm" }, () => pcm(500)],
  ["openrouter", "/v1/audio/speech", { authorization: `Bearer ${KEY}` },
    { model: "google/gemini-3.8-flash-tts", voice: "Kore", response_format: "pcm" }, () => pcm(500)],
  ["together", "/v1/audio/speech", { authorization: `Bearer ${KEY}` },
    { model: "canopylabs/orpheus-3b-0.1-ft", voice: "tara", response_format: "wav" }, () => wav(500)],
  ["groq", "/v1/audio/speech", { authorization: `Bearer ${KEY}` },
    { model: "canopylabs/orpheus-v1-english", voice: "troy", response_format: "wav" }, () => wav(500)],
  ["elevenlabs", "/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=pcm_24000", { "xi-api-key": KEY },
    { text: "Hello there.", model_id: "eleven_multilingual_v2" }, () => pcm(500)],
  ["gemini", "/v1/models/gemini-3.8-flash-tts:generateContent", { "x-goog-api-key": KEY },
    { generationConfig: { responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } } },
    () => Buffer.from(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav",
      data: wav(500).toString("base64") } }] } }] }))],
] as const)("%s: sends the provider's request and writes 24 kHz mono PCM16 WAV", async (adapter, path, headers, body, reply) => {
  answer = (_, res) => res.end(reply());
  const dir = folder();
  const voice = voiceFor(adapter);
  await voice.synthesize([{ index: 0, text: "Hello there.", file: join(dir, "000.wav") }]);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatchObject({ method: "POST", url: path, headers, body });
  const audio = probe(join(dir, "000.wav"));
  expect(audio).toMatchObject({ codec_name: "pcm_s16le", channels: 1, sample_rate: "24000" });
  expect(Number(audio.duration)).toBeCloseTo(0.5, 1);
});

it("reads Gemini's raw L16 audio at the rate its MIME type gives", async () => {
  answer = (_, res) => res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: {
    mimeType: "audio/L16;codec=pcm;rate=16000", data: pcm(800, 16000).toString("base64") } }] } }] }));
  const dir = folder();
  await voiceFor("gemini").synthesize([{ index: 0, text: "Hi.", file: join(dir, "000.wav") }]);
  expect(Number(probe(join(dir, "000.wav")).duration)).toBeCloseTo(0.8, 1);
});

it("records the provider and model, so changing either voices the comments again (the reel cache's key)", () => {
  expect(voiceFor("openai", { model: "tts-1", speaker: "nova" }).voice)
    .toEqual({ adapter: "openai:tts-1", voice: "nova", seed: 0, language: "auto" });
});

it("passes a language only to providers that take one", async () => {
  answer = (_, res) => res.end(wav(200));
  const dir = folder();
  await voiceFor("together", { language: "fr" }).synthesize([{ index: 0, text: "Bonjour.", file: join(dir, "0.wav") }]);
  answer = (_, res) => res.end(pcm(200));
  await voiceFor("openai", { language: "fr" }).synthesize([{ index: 0, text: "Bonjour.", file: join(dir, "1.wav") }]);
  expect(seen.map((s) => s.body.language)).toEqual(["fr", undefined]);
});

it("sends no key to an OpenAI-compatible server that needs none", async () => {
  answer = (_, res) => res.end(wav(200));
  const { voice } = resolveSettings({ version: 1, voice: { adapter: "openai-compatible", baseUrl: `${base}/`, model: "kokoro" } });
  await cloudVoice(voice, { env: {} }).synthesize([{ index: 0, text: "Hi.", file: join(folder(), "0.wav") }]);
  expect(seen[0].url).toBe("/v1/audio/speech");
  expect(seen[0].headers.authorization).toBeUndefined();
});

it("retries rate limits and server errors, then voices the comment", async () => {
  let calls = 0;
  answer = (_, res) => {
    calls++;
    if (calls === 1) { res.statusCode = 429; res.setHeader("retry-after", "0"); return res.end("slow down"); }
    if (calls === 2) { res.statusCode = 503; return res.end("busy"); }
    res.end(pcm(200));
  };
  const dir = folder();
  await voiceFor("openai").synthesize([{ index: 0, text: "Hi.", file: join(dir, "0.wav") }]);
  expect(calls).toBe(3);
  expect(probe(join(dir, "0.wav")).codec_name).toBe("pcm_s16le");
});

it("names the key's variable on a rejected key, never the key", async () => {
  answer = (_, res) => { res.statusCode = 401; res.end('{"error":{"message":"Incorrect API key provided"}}'); };
  const error = await voiceFor("openai").synthesize([{ index: 3, text: "Hi.", file: join(folder(), "0.wav") }])
    .catch((e: Error) => e);
  expect((error as Error).message).toBe('voice openai answered HTTP 401 for step 3 (check the key in OPENAI_API_KEY): ' +
    '{"error":{"message":"Incorrect API key provided"}}');
  expect((error as Error).message).not.toContain(KEY);
  expect(seen).toHaveLength(1);
});

it("says when the audio can't be read", async () => {
  answer = (_, res) => res.end("not audio");
  await expect(voiceFor("groq").synthesize([{ index: 1, text: "Hi.", file: join(folder(), "0.wav") }]))
    .rejects.toThrow(/^voice groq, step 1: ffmpeg could not read the audio/);
});

it("voices a few comments at a time", async () => {
  let open = 0; let most = 0;
  answer = (_, res) => {
    open++; most = Math.max(most, open);
    setTimeout(() => { open--; res.end(pcm(100)); }, 30);
  };
  const dir = folder();
  const jobs = Array.from({ length: 10 }, (_, index) => ({ index, text: `Line ${index}.`, file: join(dir, `${index}.wav`) }));
  await voiceFor("openai").synthesize(jobs);
  expect(seen).toHaveLength(10);
  expect(most).toBe(4);
});

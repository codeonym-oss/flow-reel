// Cloud voices (GH-49): one request per comment to the provider's speech API, a few at a time. ffmpeg turns each
// response into the mono 16-bit WAV the composer expects. The key is read from the environment variable the settings
// name, and appears in no message, file or argument.
import { spawn } from "node:child_process";
import type { ClipRequest, Voice } from "../../composer/ports.ts";
import type { VoiceSettings } from "../../settings.ts";

/** What a provider sent back: a self-describing file (WAV, MP3), or headerless 16-bit mono PCM at `pcmRate`. */
export interface SpokenAudio { bytes: Buffer; pcmRate?: number }

export interface Call { baseUrl: string; key?: string; model: string; speaker: string; language: string; text: string }
/** Builds one provider's HTTP request, and reads its response. */
interface Provider {
  request(call: Call): { url: string; headers: Record<string, string>; body: unknown };
  read(response: Response): Promise<SpokenAudio>;
}

/** A header carrying the key, or none when the server needs no key. */
const keyHeader = (name: string, value?: string): Record<string, string> => (value ? { [name]: value } : {});
const bearer = (key?: string) => keyHeader("authorization", key && `Bearer ${key}`);
const bytes = async (response: Response) => Buffer.from(await response.arrayBuffer());
/** A `rate=` in the content type, as some servers send for raw PCM. */
const rateOf = (type: string | null, fallback: number) => Number(/rate=(\d+)/.exec(type ?? "")?.[1] ?? fallback);

/** The OpenAI speech API, which OpenRouter, Together, Groq and many servers copy. */
const openaiStyle = (format: "pcm" | "wav", extra: (call: Call) => Record<string, unknown> = () => ({})): Provider => ({
  request: (call) => ({
    url: `${call.baseUrl}/audio/speech`,
    headers: bearer(call.key),
    body: { model: call.model, input: call.text, voice: call.speaker, response_format: format, ...extra(call) },
  }),
  // OpenAI's `pcm` is 24 kHz 16-bit mono.
  read: async (response) => ({ bytes: await bytes(response),
    ...(format === "pcm" ? { pcmRate: rateOf(response.headers.get("content-type"), 24000) } : {}) }),
});

const gemini: Provider = {
  request: (call) => ({
    url: `${call.baseUrl}/models/${encodeURIComponent(call.model)}:generateContent`,
    headers: keyHeader("x-goog-api-key", call.key),
    body: {
      contents: [{ role: "user", parts: [{ text: call.text }] }],
      generationConfig: { responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: call.speaker } } } },
    },
  }),
  async read(response) {
    const json = await response.json() as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const audio = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!audio?.data) throw new Error("the response has no audio");
    const raw = /L16|pcm/i.test(audio.mimeType ?? "");
    return { bytes: Buffer.from(audio.data, "base64"), ...(raw ? { pcmRate: rateOf(audio.mimeType ?? null, 24000) } : {}) };
  },
};

const elevenlabs: Provider = {
  request: (call) => ({
    url: `${call.baseUrl}/text-to-speech/${encodeURIComponent(call.speaker)}?output_format=pcm_24000`,
    headers: keyHeader("xi-api-key", call.key),
    body: { text: call.text, model_id: call.model, ...(call.language === "auto" ? {} : { language_code: call.language }) },
  }),
  read: async (response) => ({ bytes: await bytes(response), pcmRate: 24000 }),
};

export const PROVIDERS: Record<string, Provider> = {
  openai: openaiStyle("pcm"),
  openrouter: openaiStyle("pcm"),
  together: openaiStyle("wav", (call) => (call.language === "auto" ? {} : { language: call.language })),
  groq: openaiStyle("wav"),
  "openai-compatible": openaiStyle("wav"),
  gemini,
  elevenlabs,
};

/** Converts what the provider sent to 24 kHz mono 16-bit WAV at `file`. */
export function toWav(audio: SpokenAudio, file: string): Promise<void> {
  const input = audio.pcmRate ? ["-f", "s16le", "-ar", String(audio.pcmRate), "-ac", "1"] : [];
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-v", "error", "-y", ...input, "-i", "pipe:0", "-ar", "24000", "-ac", "1",
      "-c:a", "pcm_s16le", "-f", "wav", file], { stdio: ["pipe", "ignore", "pipe"] });
    let diagnostics = "";
    child.stderr.on("data", (chunk: Buffer) => { diagnostics = (diagnostics + chunk).slice(-4096); });
    child.once("error", reject);
    child.stdin.on("error", () => {}); // reported with ffmpeg's diagnostics
    child.once("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg could not read the audio: ${diagnostics.trim()}`))));
    child.stdin.end(audio.bytes);
  });
}

export interface CloudOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  /** Requests in flight at once. */
  concurrency?: number;
  /** Tries per comment, for rate limits, server errors and dropped connections. */
  attempts?: number;
  /** Milliseconds before the first retry; it doubles each time. */
  backoffMs?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function cloudVoice(settings: VoiceSettings, options: CloudOptions = {}): Voice {
  const { adapter, speaker, language, model, apiKeyEnv, baseUrl } = settings;
  const provider = PROVIDERS[adapter];
  if (!provider || !model || !baseUrl) throw new Error(`voice ${adapter} is not a cloud voice with a model and a server`);
  const { env = process.env, fetch: send = fetch, concurrency = 4, attempts = 4, backoffMs = 1000, timeoutMs = 120_000 } = options;
  const key = apiKeyEnv ? env[apiKeyEnv] : undefined;
  const name = `voice ${adapter}`;

  async function speak(job: ClipRequest): Promise<void> {
    const { url, headers, body } = provider.request({ baseUrl: baseUrl!.replace(/\/+$/, ""), key, model: model!, speaker,
      language, text: job.text });
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await send(url, { method: "POST", headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        if (attempt < attempts) { await sleep(backoffMs * 2 ** (attempt - 1)); continue; }
        throw new Error(`${name} could not be reached at ${baseUrl}: ${(error as Error).message}`, { cause: error });
      }
      if (response.ok) {
        try { return await toWav(await provider.read(response), job.file); }
        catch (error) { throw new Error(`${name}, step ${job.index}: ${(error as Error).message}`, { cause: error }); }
      }
      const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 300);
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : backoffMs * 2 ** (attempt - 1));
        continue;
      }
      const hint = response.status === 401 || response.status === 403
        ? ` (check the key in ${apiKeyEnv ?? "the environment"})` : "";
      throw new Error(`${name} answered HTTP ${response.status} for step ${job.index}${hint}: ${detail}`);
    }
  }

  return {
    voice: { adapter: `${adapter}:${model}`, voice: speaker, seed: 0, language },
    async synthesize(jobs) {
      const queue = [...jobs];
      const worker = async () => {
        // A failure empties the queue, so the other workers stop after their current request.
        try { for (let job = queue.shift(); job; job = queue.shift()) await speak(job); }
        catch (error) { queue.length = 0; throw error; }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
    },
  };
}

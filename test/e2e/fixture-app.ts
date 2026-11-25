// The fixture app the record tests compose, served from the host's 127.0.0.1, with a fake OpenAI voice beside it
// (GH-92): composes that test something other than the voice use it, so they don't wait for the local voice.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

// The slow reply a speedUp waits for (GH-61): 20 s at ×4 checks the same ratio as the story's 60 s, in less CI time.
export const SLOW_MS = 20_000;
export const FAKE_KEY = "sk-e2e-fake-key";

/** 1.2 s of a 440 Hz tone: raw 24 kHz 16-bit mono, as OpenAI's `pcm` format is. */
export const tone = () => {
  const buffer = Buffer.alloc(24000 * 1.2 * 2);
  for (let i = 0; i < buffer.length / 2; i++) buffer.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 440 * i) / 24000)), i * 2);
  return buffer;
};

/** The settings of the fake voice. */
export const fakeVoice = (port: number) => ({ voice: { adapter: "openai", speaker: "nova", baseUrl: `http://localhost:${port}/v1` } });

export async function startFixtureApp(): Promise<{ port: number; close: () => void }> {
  const html = readFileSync(resolve("test/e2e/app/index.html"));
  const server = createServer((req, res) => {
    if (req.url === "/delayed") return void setTimeout(() => res.writeHead(200).end("ready"), 350);
    if (req.url === "/slow") return void setTimeout(() => res.writeHead(200).end("reply"), SLOW_MS);
    if (req.method === "POST" && req.url === "/v1/audio/speech") {
      req.resume().on("end", () => res.writeHead(200, { "content-type": "audio/pcm" }).end(tone()));
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { port: (server.address() as AddressInfo).port, close: () => server.close() };
}

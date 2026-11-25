// A cloud voice through the whole composer (GH-49): the host passes the key's variable by name, the container calls the
// provider (here a server on the host that answers like OpenAI), and a second compose reuses every clip.
import { mkdirSync, readFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { FAKE_KEY, tone } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";
import { compose, makeProject } from "./project.ts";

const OUT = resolve("test/e2e/out/cloud-voice");
const html = readFileSync(resolve("test/e2e/app/index.html"));
const KEY = FAKE_KEY;
let server: Server;
let port: number;
const requests: { auth?: string; body: { model: string; input: string; voice: string; response_format: string } }[] = [];

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  prepareImage("cloud");
  server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/audio/speech") {
      let text = "";
      req.on("data", (chunk) => { text += chunk; });
      req.on("end", () => {
        requests.push({ auth: req.headers.authorization, body: JSON.parse(text) });
        res.writeHead(200, { "content-type": "audio/pcm" }).end(tone());
      });
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
}, 900_000);

afterAll(() => server?.close());

it("composes with a cloud voice, and reuses its clips on the next compose", async () => {
  const dir = join(OUT, "openai");
  const project = makeProject(dir, { "demo.reel.ts": `import { script } from "flow-reel";

export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ page, comment }) => {
  comment("Type a name.");
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("button", { name: "Save" }).comment("Save it.").click();
});
` }, { voice: { adapter: "openai", speaker: "nova", baseUrl: `http://localhost:${port}/v1` } });

  const first = await compose(project);
  expect(first.stderr).toContain("voiced 2 of 2 comments (0 reused)");
  // Comments are voiced concurrently, so their requests arrive in either order.
  expect([...requests].sort((a, b) => a.body.input.localeCompare(b.body.input))).toEqual([
    { auth: `Bearer ${KEY}`, body: { model: "gpt-4o-mini-tts", input: "Save it.", voice: "nova", response_format: "pcm" } },
    { auth: `Bearer ${KEY}`, body: { model: "gpt-4o-mini-tts", input: "Type a name.", voice: "nova", response_format: "pcm" } },
  ]);
  const transcript = JSON.parse(readFileSync(join(first.reel, "transcript.json"), "utf8"));
  expect(transcript.voice).toEqual({ adapter: "openai:gpt-4o-mini-tts", voice: "nova", seed: 0, language: "auto" });
  for (const step of transcript.steps) expect(step.audio.durationMs).toBe(1200);
  for (const file of ["transcript.json", "manifest.json", "events.json"]) {
    expect(readFileSync(join(first.reel, file), "utf8")).not.toContain(KEY);
  }

  const second = await compose(project);
  expect(second.stderr).toContain("voiced 0 of 2 comments (2 reused)");
  expect(requests).toHaveLength(2);
}, 900_000);

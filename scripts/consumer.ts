import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { validateTranscript } from "../src/composer/schema/transcript.ts";
import { validateEvents } from "../src/composer/schema/events.ts";
import { validateSync } from "../src/composer/schema/sync.ts";

const spec = process.argv[2];
assert(spec, "provide a tested tarball path or flow-reel@version");
const dir = resolve(process.env.FLOW_REEL_CONSUMER_OUT ?? mkdtempSync(join(tmpdir(), "flow-reel-consumer-")));
mkdirSync(dir, { recursive: true });
const docker = execFileSync("which", ["docker"], { encoding: "utf8" }).trim();
// Fail loudly if the installed CLI tries its development fallback. Preserve actual run/pull behavior.
const commands = join(dir, "docker.log");
writeFileSync(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${commands}'\n[ "$1" != build ] || exit 99\nexec '${docker}' "$@"\n`, { mode: 0o755 });
const html = readFileSync("test/e2e/app/index.html");
const server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(html));
await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;
writeFileSync(join(dir, "demo.ts"), `import { script, Sounds } from "flow-reel";
export default script({ url: "http://localhost:${port}/", viewport: [960, 540] }, async ({ page, comment }) => {
  comment("Enter a name.");
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("button", { name: "Save" }).comment("Save the changes.").sound(Sounds.feedback.SUCCESS).click();
});\n`);
try {
  const args = spec.startsWith("flow-reel@") ? ["--yes", spec] : ["--yes", "--package", resolve(spec), "flow-reel"];
  const result = await promisify(execFile)("npx", [...args, "compose", join(dir, "demo.ts")], {
    cwd: dir, timeout: 900_000, maxBuffer: 4 << 20,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, npm_config_cache: join(dir, "npm-cache"), npm_config_userconfig: "/dev/null" },
  });
  writeFileSync(join(dir, "record.log"), result.stdout + result.stderr);
  assert.doesNotMatch(result.stderr, /building it locally/);
  assert.doesNotMatch(readFileSync(commands, "utf8"), /^build /m);
  const transcript = JSON.parse(readFileSync(join(dir, "demo.reel", "transcript.json"), "utf8"));
  assert.deepEqual(validateTranscript(transcript), []);
  assert.deepEqual(validateSync(transcript), []);
  assert.deepEqual(validateEvents(JSON.parse(readFileSync(join(dir, "demo.reel", "events.json"), "utf8"))), []);
  assert.equal(transcript.steps.length, 2);
  assert(transcript.steps.every((s: { audio?: unknown }) => s.audio));
  for (const file of ["captions.srt", "captions.vtt", "video.mp4"]) assert(readFileSync(join(dir, "demo.reel", file)).length > 0);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", join(dir, "demo.reel", "video.mp4")], { encoding: "utf8" }));
  assert.deepEqual(probe.streams.map((s: { codec_type: string }) => s.codec_type), ["video", "audio"]);
  const verified = await promisify(execFile)("npx", [...args, "verify", join(dir, "demo.reel")], {
    cwd: dir, env: { ...process.env, npm_config_cache: join(dir, "npm-cache"), npm_config_userconfig: "/dev/null" },
  });
  assert.match(verified.stdout, /^Reel matches its manifest/);
  console.log(`Consumer passed: ${spec}; outputs ${dir}`);
} catch (error) {
  writeFileSync(join(dir, "record.log"), (error as { stderr?: string }).stderr ?? String(error));
  throw error;
} finally { server.close(); }

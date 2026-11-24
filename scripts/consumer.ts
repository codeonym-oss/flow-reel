import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { validateTranscript } from "../src/composer/schema/transcript.ts";
import { validateEvents } from "../src/composer/schema/events.ts";
import { validateSync } from "../src/composer/schema/sync.ts";
import { FAKE_KEY, fakeVoice, startFixtureApp } from "../test/e2e/fixture-app.ts";

const spec = process.argv[2];
assert(spec, "provide a tested tarball path or flow-reel@version");
const dir = resolve(process.env.FLOW_REEL_CONSUMER_OUT ?? mkdtempSync(join(tmpdir(), "flow-reel-consumer-")));
mkdirSync(dir, { recursive: true });
const docker = execFileSync("which", ["docker"], { encoding: "utf8" }).trim();
// Fail loudly if the installed CLI tries its development fallback. Preserve actual run/pull behavior.
writeFileSync(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FLOW_REEL_CONSUMER_LOG"\n[ "$1" != build ] || exit 99\nexec '${docker}' "$@"\n`, { mode: 0o755 });
const app = await startFixtureApp();
const args = spec.startsWith("flow-reel@") ? ["--yes", spec] : ["--yes", "--package", resolve(spec), "flow-reel"];
const npm = { npm_config_cache: join(dir, "npm-cache"), npm_config_userconfig: "/dev/null" };

/** Composes in its own folder, checks the reel, and that only the image the voice needs was inspected, pulled or run. */
async function consume(target: "cloud" | "full", config?: object) {
  const out = join(dir, target);
  mkdirSync(out, { recursive: true });
  const commands = join(out, "docker.log");
  writeFileSync(join(out, "demo.ts"), `import { script, Sounds } from "flow-reel";
export default script({ url: "http://localhost:${app.port}/", viewport: [960, 540] }, async ({ page, comment }) => {
  comment("Enter a name.");
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("button", { name: "Save" }).comment("Save the changes.").sound(Sounds.feedback.SUCCESS).click();
});\n`);
  if (config) writeFileSync(join(out, "flow-reel.json"), JSON.stringify(config));
  try {
    const result = await promisify(execFile)("npx", [...args, "compose", join(out, "demo.ts")], {
      cwd: out, timeout: 900_000, maxBuffer: 4 << 20,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ...npm, FLOW_REEL_CONSUMER_LOG: commands, OPENAI_API_KEY: FAKE_KEY },
    });
    writeFileSync(join(out, "record.log"), result.stdout + result.stderr);
    assert.doesNotMatch(result.stderr, /building it locally/);
  } catch (error) {
    writeFileSync(join(out, "record.log"), (error as { stderr?: string }).stderr ?? String(error));
    throw error;
  }
  const log = readFileSync(commands, "utf8");
  assert.doesNotMatch(log, /^build /m);
  assert.match(log, /^run /m);
  const tags = [...log.matchAll(/ghcr\.io\/codeonym-oss\/flow-reel:(\S+)/g)].map(([, tag]) => tag);
  for (const tag of tags) assert.match(tag, target === "cloud" ? /^[\d.]+-cloud$/ : /^[\d.]+$/);
  const transcript = JSON.parse(readFileSync(join(out, "demo.reel", "transcript.json"), "utf8"));
  assert.deepEqual(validateTranscript(transcript), []);
  assert.deepEqual(validateSync(transcript), []);
  assert.deepEqual(validateEvents(JSON.parse(readFileSync(join(out, "demo.reel", "events.json"), "utf8"))), []);
  assert.match(transcript.voice.adapter, target === "cloud" ? /^openai:/ : /^qwen3-tts-0\.6b$/);
  assert.equal(transcript.steps.length, 2);
  assert(transcript.steps.every((s: { audio?: unknown }) => s.audio));
  for (const file of ["captions.srt", "captions.vtt", "video.mp4"]) assert(readFileSync(join(out, "demo.reel", file)).length > 0);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", join(out, "demo.reel", "video.mp4")], { encoding: "utf8" }));
  assert.deepEqual(probe.streams.map((s: { codec_type: string }) => s.codec_type), ["video", "audio"]);
  const verified = await promisify(execFile)("npx", [...args, "verify", join(out, "demo.reel")], { cwd: out, env: { ...process.env, ...npm } });
  assert.match(verified.stdout, /^Reel matches its manifest/);
  console.log(`Consumer passed: ${spec}, ${[...new Set(tags)].join(", ")}; outputs ${out}`);
}

try {
  await consume("cloud", { version: 1, voice: fakeVoice(app.port).voice });
  await consume("full");
} finally { app.close(); }

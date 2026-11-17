// The plugin's helpers at their process and filesystem boundaries (GH-6 decision 009): fake engines on PATH, a local
// HTTP server and a small real reel. Neither helper installs, pulls, builds or starts anything.
import { execFile, execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashFiles, listReelFiles } from "../../src/reel.ts";

const root = resolve(import.meta.dirname, "../..");
const preflight = join(root, "plugin/scripts/preflight.mjs");
const stills = join(root, "plugin/scripts/stills.mjs");
const work = mkdtempSync(join(tmpdir(), "flow reel helpers "));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** A PATH holding node and, optionally, a fake `docker` that logs its arguments and answers as told. */
function fakePath(name: string, docker?: { version?: boolean; info?: boolean; image?: boolean }): { path: string; log: string } {
  const dir = join(work, name);
  mkdirSync(dir, { recursive: true });
  symlinkSync(process.execPath, join(dir, "node"));
  const log = join(dir, "docker.log");
  if (docker) {
    const code = (ok?: boolean) => (ok ? 0 : 1);
    writeFileSync(join(dir, "docker"), `#!/bin/sh
echo "$@" >> "${log}"
case "$1" in
  --version) echo "Docker version 28.0.0"; exit ${code(docker.version)};;
  info) exit ${code(docker.info)};;
  image) exit ${code(docker.image)};;
  *) exit 3;;
esac
`);
    chmodSync(join(dir, "docker"), 0o755);
  }
  return { path: dir, log };
}

async function run(script: string, args: string[], path?: string, env: NodeJS.ProcessEnv = {}) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [script, ...args],
      { encoding: "utf8", env: { ...process.env, ...(path ? { PATH: path } : {}), ...env } });
    return { status: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { status: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

interface Check { name: string; status: string; detail: string; fix?: string }
const checks = (stdout: string) => Object.fromEntries((JSON.parse(stdout).checks as Check[]).map((c) => [c.name, c]));

describe("preflight.mjs", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/login-wall") { res.writeHead(302, { location: "/login" }); res.end(); return; }
      res.writeHead(req.url === "/missing" ? 404 : 200); res.end("ok");
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("passes with an answering engine, the image present, a supported runtime and an answering app", async () => {
    const fake = fakePath("all-good", { version: true, info: true, image: true });
    const result = await run(preflight, ["--url", `${base}/`, "--version", "0.5.0", "--json"], fake.path);
    expect(result.status).toBe(0);
    const c = checks(result.stdout);
    expect([c.engine.status, c.runtime.status, c.image.status, c.url.status]).toEqual(["ok", "ok", "ok", "ok"]);
  });

  it("fails without an engine, and names an engine that is installed but not answering", async () => {
    const none = await run(preflight, ["--version", "0.5.0", "--json"], fakePath("no-engine").path);
    expect(none.status).toBe(1);
    expect(checks(none.stdout).engine.detail).toMatch(/neither Docker nor Podman/);
    const down = await run(preflight, ["--version", "0.5.0", "--json"], fakePath("engine-down", { version: true, info: false }).path);
    expect(down.status).toBe(1);
    expect(checks(down.stdout).engine).toMatchObject({ status: "fail", detail: "docker installed but not answering" });
  });

  it("reports a missing image with the pull command, and never pulls it", async () => {
    const fake = fakePath("no-image", { version: true, info: true, image: false });
    const result = await run(preflight, ["--version", "0.5.0", "--json"], fake.path);
    expect(result.status).toBe(0);
    expect(checks(result.stdout).image).toMatchObject({ status: "note", fix: "docker pull ghcr.io/codeonym-oss/flow-reel:0.5.0" });
    expect(readFileSync(fake.log, "utf8")).not.toMatch(/^(pull|build|run)/m);
  });

  it("fails a runtime outside the plugin's range, and finds the one installed beside the script", async () => {
    const fake = fakePath("range", { version: true, info: true, image: true });
    const old = await run(preflight, ["--version", "0.1.2", "--json"], fake.path);
    expect(old.status).toBe(1);
    const range = /^\*\*Supported runtime:\*\* `([^`]+)`$/m.exec(readFileSync(join(root, "plugin/references/language.md"), "utf8"))![1];
    expect(checks(old.stdout).runtime.detail).toBe(`flow-reel 0.1.2 (--version); this plugin supports ${range}`);
    const project = join(work, "a project", "demos");
    mkdirSync(project, { recursive: true });
    mkdirSync(join(project, "../node_modules/flow-reel"), { recursive: true });
    writeFileSync(join(project, "../node_modules/flow-reel/package.json"), JSON.stringify({ version: "0.5.3" }));
    writeFileSync(join(project, "settings.ts"), "");
    const found = await run(preflight, ["--script", join(project, "settings.ts"), "--json"], fake.path);
    expect(found.status).toBe(0);
    expect(checks(found.stdout).runtime.detail).toMatch(/^flow-reel 0\.5\.3/);
    expect(checks(found.stdout).script.status).toBe("ok");
  });

  it("checks a cloud voice's key variable, never its value (GH-49)", async () => {
    const fake = fakePath("voices", { version: true, info: true, image: true });
    const project = join(work, "voices");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "demo.ts"), "");
    const voice = async (config: unknown, version: string, env: NodeJS.ProcessEnv = {}) => {
      if (config === undefined) rmSync(join(project, "flow-reel.json"), { force: true });
      else writeFileSync(join(project, "flow-reel.json"), JSON.stringify(config));
      const result = await run(preflight, ["--script", join(project, "demo.ts"), "--version", version, "--json"], fake.path,
        { OPENAI_API_KEY: "", MY_KEY: "", ...env });
      return { ...checks(result.stdout).voice, exit: result.status };
    };
    expect(await voice(undefined, "0.5.0")).toMatchObject({ exit: 0, detail: expect.stringContaining("local voice") });
    expect(await voice({ version: 1, voice: { adapter: "openai" } }, "0.5.0"))
      .toMatchObject({ exit: 1, detail: "openai needs OPENAI_API_KEY, which isn't set here" });
    const secret = "sk-preflight-secret";
    const ok = await voice({ version: 1, voice: { adapter: "openai", apiKeyEnv: "MY_KEY" } }, "0.5.0", { MY_KEY: secret });
    expect(ok).toMatchObject({ exit: 0, detail: "openai, key in MY_KEY" });
    expect(JSON.stringify(ok)).not.toContain(secret);
    expect(await voice({ version: 1, voice: { adapter: "openai", apiKey: secret } }, "0.5.0"))
      .toMatchObject({ exit: 1, detail: expect.stringContaining("voice.apiKey") });
    expect(await voice({ version: 1, voice: { adapter: "openai-compatible", baseUrl: "http://localhost:8880/v1", model: "kokoro" } },
      "0.5.0")).toMatchObject({ exit: 0, detail: "openai-compatible at http://localhost:8880/v1, with no key" });
  });

  it("fails an app that doesn't answer or answers an error, and notes a redirect", async () => {
    const fake = fakePath("urls", { version: true, info: true, image: true });
    const url = async (u: string) => checks((await run(preflight, ["--version", "0.5.0", "--url", u, "--json"], fake.path)).stdout).url;
    expect(await url(`${base}/missing`)).toMatchObject({ status: "fail", detail: expect.stringContaining("404") });
    expect(await url(`${base}/login-wall`)).toMatchObject({ status: "note", detail: expect.stringContaining("/login") });
    expect(await url("http://127.0.0.1:1/")).toMatchObject({ status: "fail", detail: expect.stringContaining("start the app") });
    expect(await url("not a url")).toMatchObject({ status: "fail" });
  });

  it("rejects bad arguments with 2", async () => {
    expect((await run(preflight, ["--url"])).status).toBe(2);
    expect((await run(preflight, ["--wat"])).status).toBe(2);
  });
});

describe("stills.mjs", () => {
  const reel = join(work, "a demo.reel");
  const cli = join(root, "src/cli.ts");

  /** A small real reel: a 2 s video with a sound track, a two-step transcript and a matching manifest. */
  function makeReel(dir: string) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=s=320x180:r=30:d=2", "-f", "lavfi",
      "-i", "sine=d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(dir, "video.mp4")]);
    writeFileSync(join(dir, "transcript.json"), JSON.stringify({ version: 2, video: { file: "video.mp4" }, steps: [
      { comment: "Open the | settings.", startMs: 0, actionEndMs: 500, endMs: 1000 },
      { comment: "Save.", startMs: 1000, actionEndMs: 1500, endMs: 2000 }] }));
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, script: { file: "demo.ts", sha256: "a".repeat(64) },
      composer: { version: "0.2.0", platform: "linux/amd64" }, integration: "playwright", files: hashFiles(dir, listReelFiles(dir)) }));
  }

  it("writes a still at each step's start and end, a contact sheet and an index", async () => {
    makeReel(reel);
    const out = join(work, "stills out");
    const result = await run(stills, [reel, "--to", out, "--flow-reel", cli, "--json"]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.media).toMatchObject({ width: 320, height: 180, audio: true });
    expect(report.frames.map((f: { at: string; ms: number }) => `${f.at}@${f.ms}`)).toEqual(["start@0", "end@950", "start@1000", "end@1950"]);
    for (const f of ["frame-000.png", "frame-003.png", "contact-sheet.png", "index.md"]) expect(existsSync(join(out, f)), f).toBe(true);
    expect(readFileSync(join(out, "index.md"), "utf8")).toContain("Open the \\| settings.");
  }, 60_000);

  it("stops on a reel that fails verify, and on a video that can't be read", async () => {
    makeReel(reel);
    writeFileSync(join(reel, "transcript.json"), "{}");
    const tampered = await run(stills, [reel, "--to", join(work, "t"), "--flow-reel", cli]);
    expect(tampered).toMatchObject({ status: 1, stderr: expect.stringContaining("transcript.json changed") });

    makeReel(reel);
    writeFileSync(join(reel, "video.mp4"), "not a video");
    writeFileSync(join(reel, "manifest.json"), JSON.stringify({ ...JSON.parse(readFileSync(join(reel, "manifest.json"), "utf8")),
      files: hashFiles(reel, listReelFiles(reel)) }));
    const broken = await run(stills, [reel, "--to", join(work, "b"), "--flow-reel", cli]);
    expect(broken).toMatchObject({ status: 1, stderr: expect.stringContaining("video.mp4 can't be read") });
  }, 60_000);

  it("refuses an output inside the reel, a folder that isn't a reel, and runs without ffmpeg or an image only to say so", async () => {
    makeReel(reel);
    expect((await run(stills, [reel, "--to", join(reel, "stills"), "--flow-reel", cli])).status).toBe(2);
    expect((await run(stills, [work, "--to", join(work, "x"), "--flow-reel", cli])).status).toBe(2);
    const fake = fakePath("no-ffmpeg", { version: true, info: true, image: false });
    const none = await run(stills, [reel, "--to", join(work, "n"), "--flow-reel", cli], fake.path);
    expect(none).toMatchObject({ status: 2, stderr: expect.stringContaining("install ffmpeg") });
    expect(readFileSync(fake.log, "utf8")).not.toMatch(/^(pull|build|run)/m);
  }, 60_000);
});

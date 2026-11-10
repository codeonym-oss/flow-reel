import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { beforeAll, expect, it } from "vitest";

const OUT = resolve("test/e2e/out/tts");
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const image = `ghcr.io/codeonym-oss/flow-reel:${version}`;

beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
  execFileSync("docker", ["build", "-q", "-t", image, "-f", "docker/Dockerfile", "."], { stdio: "inherit" });
}, 900_000);

it("synthesizes identical playable WAVs in fresh offline processes with a reset seed per clip", async () => {
  const hashes: string[][] = [];
  for (const run of ["a", "b"]) {
    const dir = join(OUT, run);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const worker = promisify(execFile)("docker", ["run", "--rm", "--init", "--network", "none", "-i",
      "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`,
      "--entrypoint", "/opt/flow-reel/tts-venv/bin/python", image, "/opt/flow-reel/docker/tts/worker.py"],
    { timeout: 600_000, maxBuffer: 1 << 20 });
    worker.child.stdin!.end(JSON.stringify([
      { index: 0, text: "Open the settings.", file: "/work/000.wav" },
      { index: 1, text: "Scroll down and save.", file: "/work/001.wav" },
      { index: 2, text: "Open the settings.", file: "/work/002.wav" },
    ]));
    const { stdout, stderr } = await worker;
    writeFileSync(join(dir, "synthesis.log"), stderr);
    expect(JSON.parse(stdout)).toEqual({ clips: 3 });
    hashes.push([0, 1, 2].map((index) => {
      const file = join(dir, `${index.toString().padStart(3, "0")}.wav`);
      const { streams: [audio] } = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
      expect(audio).toMatchObject({ codec_name: "pcm_s16le", channels: 1 });
      expect(Number(audio.duration)).toBeGreaterThan(0);
      return createHash("sha256").update(readFileSync(file)).digest("hex");
    }));
  }
  expect(hashes[0]).toEqual(hashes[1]);
  expect(hashes[0][0]).toBe(hashes[0][2]);
}, 1_200_000);

it("fails clearly when bundled assets are missing, with no network fallback or successful output", async () => {
  const empty = join(OUT, "missing-assets");
  mkdirSync(empty, { recursive: true });
  const worker = promisify(execFile)("docker", ["run", "--rm", "--init", "--network", "none", "-i",
    "-v", `${empty}:/opt/flow-reel/tts-model:ro`, "--entrypoint", "/opt/flow-reel/tts-venv/bin/python",
    image, "/opt/flow-reel/docker/tts/worker.py"], { timeout: 60_000 });
  worker.child.stdin!.end(JSON.stringify([{ index: 0, text: "Speak.", file: "/tmp/never.wav" }]));
  await expect(worker).rejects.toMatchObject({ code: 1, stdout: "", stderr: expect.stringContaining("Qwen TTS:") });
}, 60_000);

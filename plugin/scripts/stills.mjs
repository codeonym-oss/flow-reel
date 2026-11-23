#!/usr/bin/env node
// Pulls a frame at each step's start and end from a reel's video, and a contact sheet of them, so an agent can see
// the reel (GH-6 decision 009). It reads the reel and writes only to --to; it never pulls or builds an image.
// The end still is a frame and a half before the step ends, so it lands on a frame inside the video.
// Exit 0: stills written. 1: the reel fails `flow-reel verify`, or its video can't be read. 2: bad arguments, or no
// flow-reel or ffmpeg to run.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: stills.mjs <reel> --to <dir> [--flow-reel <cli>] [--json]";
const FRAME_MS = 1000 / 30;

function parse(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if ((a === "--to" || a === "--flow-reel") && argv[i + 1] !== undefined) args[a === "--to" ? "to" : "cli"] = argv[++i];
    else if (!a.startsWith("--") && args.reel === undefined) args.reel = a;
    else return undefined;
  }
  return args.help || (args.reel && args.to) ? args : undefined;
}

class Unavailable extends Error {}
class Failed extends Error {}

/** The flow-reel CLI: --flow-reel, else the nearest node_modules/flow-reel above the reel or the current folder. */
function findCli(reel, given) {
  if (given) return resolve(given);
  for (const start of [dirname(reel), process.cwd()]) {
    for (let dir = start; ; dir = dirname(dir)) {
      const cli = join(dir, "node_modules/flow-reel/dist/cli.js");
      if (existsSync(cli)) return cli;
      if (dirname(dir) === dir) break;
    }
  }
  throw new Unavailable("no flow-reel installed beside the reel; npm install --save-dev flow-reel, or pass --flow-reel");
}

const has = (cmd) => spawnSync(cmd, ["-version"], { stdio: "ignore" }).status === 0;

/** ffmpeg and ffprobe: the host's, else the composer image's (read-only reel, writable output). */
function tools(reel, out, manifest) {
  if (has("ffmpeg") && has("ffprobe")) {
    return { ffmpeg: (args) => spawnSync("ffmpeg", args, { encoding: "utf8" }), ffprobe: (args) => spawnSync("ffprobe", args, { encoding: "utf8" }),
      reelPath: (p) => join(reel, p), outPath: (p) => join(out, p), via: "host ffmpeg" };
  }
  const image = `ghcr.io/codeonym-oss/flow-reel:${manifest.composer?.version}`;
  for (const engine of ["docker", "podman"]) {
    if (spawnSync(engine, ["image", "inspect", image], { stdio: "ignore" }).status !== 0) continue;
    const user = process.getuid ? ["--user", `${process.getuid()}:${process.getgid()}`] : [];
    const run = (entry) => (args) => spawnSync(engine, ["run", "--rm", "--network", "none", ...user,
      "-v", `${reel}:/reel:ro`, "-v", `${out}:/out`, "--entrypoint", entry, image, ...args], { encoding: "utf8" });
    return { ffmpeg: run("ffmpeg"), ffprobe: run("ffprobe"), reelPath: (p) => `/reel/${p}`, outPath: (p) => `/out/${p}`, via: image };
  }
  throw new Unavailable(`no ffmpeg and ffprobe on PATH, and ${image} isn't present locally; install ffmpeg`);
}

export function stills({ reel: reelArg, to, cli }) {
  const reel = resolve(reelArg);
  const out = resolve(to);
  if (out === reel || out.startsWith(reel + sep)) throw new Unavailable("--to is inside the reel; flow-reel verify would then fail");
  if (!existsSync(join(reel, "manifest.json"))) throw new Unavailable(`${reelArg} isn't a reel (no manifest.json)`);

  const verified = spawnSync(process.execPath, [findCli(reel, cli), "verify", reel], { encoding: "utf8" });
  if (verified.status !== 0) throw new Failed(`flow-reel verify failed:\n${(verified.stdout + verified.stderr).trim()}`);

  const manifest = JSON.parse(readFileSync(join(reel, "manifest.json"), "utf8"));
  const transcript = JSON.parse(readFileSync(join(reel, "transcript.json"), "utf8"));
  const video = transcript.video?.file ?? "video.mp4";
  mkdirSync(out, { recursive: true });
  for (const name of readdirSync(out)) if (/^(frame-\d{3}\.png|contact-sheet\.png|index\.md)$/.test(name)) rmSync(join(out, name));
  const t = tools(reel, out, manifest);

  const probe = t.ffprobe(["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", t.reelPath(video)]);
  if (probe.status !== 0) throw new Failed(`${video} can't be read: ${probe.stderr.trim()}`);
  const info = JSON.parse(probe.stdout);
  const v = info.streams.find((s) => s.codec_type === "video");
  if (!v) throw new Failed(`${video} has no video stream`);
  const durationMs = Number(info.format.duration) * 1000;
  const media = { width: v.width, height: v.height, fps: v.r_frame_rate, audio: info.streams.some((s) => s.codec_type === "audio"), durationMs: Math.round(durationMs) };

  const frames = [];
  transcript.steps.forEach((step, index) => {
    const end = Math.max(step.startMs, Math.min(step.endMs, durationMs) - 1.5 * FRAME_MS);
    for (const [at, ms] of [["start", step.startMs], ["end", end]]) {
      const file = `frame-${String(frames.length).padStart(3, "0")}.png`;
      const r = t.ffmpeg(["-v", "error", "-y", "-ss", (ms / 1000).toFixed(3), "-i", t.reelPath(video), "-frames:v", "1", "-vf", "scale=960:-2", t.outPath(file)]);
      if (r.status !== 0 || !existsSync(join(out, file))) throw new Failed(`no frame at ${Math.round(ms)} ms: ${r.stderr.trim()}`);
      frames.push({ file, step: index, at, ms: Math.round(ms), comment: step.comment ?? "" });
    }
  });

  if (frames.length) {
    const rows = Math.ceil(frames.length / 4);
    const sheet = t.ffmpeg(["-v", "error", "-y", "-framerate", "1", "-i", t.outPath("frame-%03d.png"), "-vf", `scale=480:-2,tile=4x${rows}:padding=8:color=0x202020`, "-frames:v", "1", t.outPath("contact-sheet.png")]);
    if (sheet.status !== 0) throw new Failed(`the contact sheet failed: ${sheet.stderr.trim()}`);
  }
  const lines = ["# Stills", "", `${relative(process.cwd(), reel) || reel}: ${media.width}×${media.height}, ${media.fps} fps, ` +
    `${(media.durationMs / 1000).toFixed(1)} s, ${media.audio ? "with" : "no"} audio (via ${t.via}).`, "",
    "`contact-sheet.png` reads left to right, four frames a row: each step's start, then its end.", "",
    "| Frame | Step | At | ms | Comment |", "|---|---|---|---|---|",
    ...frames.map((f) => `| ${f.file} | ${f.step} | ${f.at} | ${f.ms} | ${f.comment.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")} |`)];
  writeFileSync(join(out, "index.md"), lines.join("\n") + "\n");
  return { reel, out, media, frames, contactSheet: frames.length ? join(out, "contact-sheet.png") : undefined };
}

function main() {
  const args = parse(process.argv.slice(2));
  if (!args) { console.error(USAGE); return 2; }
  if (args.help) { console.log(USAGE); return 0; }
  try {
    const result = stills(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.log(`${result.frames.length} stills of ${result.frames.length / 2} steps in ${result.out} ` +
      `(${result.media.width}×${result.media.height}, ${(result.media.durationMs / 1000).toFixed(1)} s, ${result.media.audio ? "with" : "no"} audio); see index.md`);
    return 0;
  } catch (error) {
    console.error(`stills: ${error.message}`);
    return error instanceof Failed ? 1 : 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();

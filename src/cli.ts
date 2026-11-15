#!/usr/bin/env node
// `flow-reel compose <script>`: on the host it starts the container; inside it (FLOW_REEL_IN_CONTAINER=1) it composes
// the script, with the adapters chosen here. `verify` and `compare` read reels on the host.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWN, type SettingsFlags, resolveSettings } from "./settings.ts";

const USAGE = "usage: flow-reel compose <script.ts> [--no-sound] [--out <dir>] [--integration <name>] [--voice <name>] " +
  "[--speaker <name>] [--language <name>] [--model <id>] [--api-key-env <variable>] [--base-url <url>] [--save-config] | flow-reel verify <reel> | flow-reel compare <a.reel> <b.reel>";

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

/** A reel's errors and differences, each prefixed with its path. */
async function checkReel(dir: string): Promise<{ errors: string[]; differences: string[] }> {
  const { verifyReel } = await import("./reel.ts");
  const { errors, differences } = verifyReel(dir);
  return { errors: errors.map((e) => `${dir}: ${e}`), differences: differences.map((d) => `${dir}: ${d}`) };
}

async function verify(args: string[]): Promise<number> {
  if (args.length !== 1) { console.error(USAGE); return 2; }
  const { errors, differences } = await checkReel(args[0]);
  if (errors.length) { console.error(errors.join("\n")); return 2; }
  if (differences.length) { console.log(differences.join("\n")); return 1; }
  const { listReelFiles } = await import("./reel.ts");
  const count = listReelFiles(args[0]).length;
  console.log(`Reel matches its manifest (${count} file${count === 1 ? "" : "s"}).`);
  return 0;
}

async function compare(args: string[]): Promise<number> {
  if (args.length !== 2) { console.error(USAGE); return 2; }
  if (args.some((arg) => arg.endsWith(".json"))) {
    console.error("flow-reel: compare takes two reel folders, e.g. demos/a.reel demos/b.reel");
    return 2;
  }
  const problems = [];
  for (const dir of args) { const { errors, differences } = await checkReel(dir); problems.push(...errors, ...differences); }
  if (problems.length) { console.error(problems.join("\n")); return 2; }
  const { compareEffects, compareTranscripts } = await import("./compare.ts");
  const [left, right] = args;
  const read = (dir: string, file: string): unknown => {
    try { return readJson(join(dir, file)); }
    catch (error) { throw new Error(`${dir}: ${(error as Error).message}`); }
  };
  const result = { errors: [] as string[], differences: [] as string[] };
  try {
    for (const [file, check] of [["transcript.json", compareTranscripts], ["events.json", compareEffects]] as const) {
      const { errors, differences } = check(read(left, file), read(right, file));
      result.errors.push(...errors);
      result.differences.push(...differences);
    }
  } catch (error) { console.error(`flow-reel: ${(error as Error).message}`); return 2; }
  if (result.errors.length) {
    for (const error of result.errors) console.error(error.replace(/^left:/, `${left}:`).replace(/^right:/, `${right}:`));
    return 2;
  }
  if (result.differences.length) { console.log(result.differences.join("\n")); return 1; }
  console.log("Reels match (step starts and effects within 150 ms).");
  return 0;
}

const SETTING_FLAGS = { "--integration": "integration", "--voice": "voice", "--speaker": "speaker", "--language": "language",
  "--model": "model", "--api-key-env": "apiKeyEnv", "--base-url": "baseUrl" } as const;

interface ComposeArgs { script: string; sound: boolean; outDir?: string; flags: SettingsFlags; saveConfig: boolean }

/** `compose` arguments: one script; `--no-sound`, `--save-config` and each flag with a value at most once. */
function parseCompose(args: string[]): ComposeArgs | undefined {
  const positionals: string[] = [];
  let sound = true; let outDir: string | undefined; let saveConfig = false;
  const flags: SettingsFlags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-sound") { if (!sound) return undefined; sound = false; }
    else if (arg === "--save-config") { if (saveConfig) return undefined; saveConfig = true; }
    else if (arg === "--out" || arg in SETTING_FLAGS) {
      const value = args[++i];
      if (value === undefined || value.startsWith("-")) return undefined;
      if (arg === "--out") {
        if (outDir !== undefined) return undefined;
        outDir = value;
      } else {
        const key = SETTING_FLAGS[arg as keyof typeof SETTING_FLAGS];
        if (flags[key] !== undefined) return undefined;
        flags[key] = value;
      }
    } else if (arg.startsWith("-")) return undefined;
    else positionals.push(arg);
  }
  return positionals.length === 1 ? { script: positionals[0], sound, outDir, flags, saveConfig } : undefined;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  if (command === "verify") return verify(args);
  if (command === "compare") return compare(args);
  if (command === "record") { console.error("flow-reel: `record` is now `compose` (flow-reel 0.2)"); return 2; }
  const parsed = command === "compose" ? parseCompose(args) : undefined;
  if (!parsed) { console.error(USAGE); return 2; }
  const { script, ...options } = parsed;
  if (process.env.FLOW_REEL_IN_CONTAINER === "1") {
    // The host resolved the settings; they are checked again before any adapter loads.
    const settings = resolveSettings(undefined, options.flags);
    const { compose } = await import("./composer/compose.ts");
    const { playwright } = await import("./adapters/playwright/integration.ts");
    const voice = KNOWN.voices[settings.voice.adapter].cloud
      ? (await import("./adapters/cloud/voice.ts")).cloudVoice(settings.voice)
      : (await import("./adapters/qwen/voice.ts")).qwenVoice(settings.voice);
    const { folderStore } = await import("./adapters/folder/store.ts");
    const { version } = readJson(resolve(dirname(fileURLToPath(import.meta.url)), "../package.json")) as { version: string };
    await compose(resolve(script), { integration: playwright, voice, store: folderStore,
      composerVersion: version, sound: options.sound, ...(options.outDir ? { outDir: resolve(options.outDir) } : {}) });
    return 0;
  }
  const { launch } = await import("./host/launch.ts");
  return launch(script, options);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`flow-reel: ${e.message}`);
    process.exit(1);
  },
);

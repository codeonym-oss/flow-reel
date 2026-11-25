#!/usr/bin/env node
// Checks what `flow-reel compose` needs, and changes nothing (GH-6 decision 009): Node, an engine whose daemon
// answers, a runtime the plugin supports, the workspace, the composer image, the voice and its key, the script, and the
// app's URL.
// Exit 0: every check passes. 1: a check failed. 2: bad arguments.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: preflight.mjs [--url <url>] [--version <runtime>] [--script <file>] [--json]";
const here = dirname(fileURLToPath(import.meta.url));

function parse(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--json") args.json = true;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else if (["--url", "--version", "--script"].includes(flag) && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
      args[flag.slice(2)] = argv[++i];
    } else return undefined;
  }
  return args;
}

/** The range forms the plugin states: `>=A.B.C`, or `>=A.B.C <X.Y.Z`. */
export function satisfies(version, range) {
  const match = /^>=(\d+\.\d+\.\d+)(?: <(\d+\.\d+\.\d+))?$/.exec(range);
  if (!match || !/^\d+\.\d+\.\d+/.test(version)) return false;
  const parts = (v) => v.split(/[-+]/)[0].split(".").map(Number);
  const cmp = (a, b) => {
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  return cmp(version, match[1]) >= 0 && (match[2] === undefined || cmp(version, match[2]) < 0);
}

export function supportedRange() {
  const text = readFileSync(join(here, "../references/language.md"), "utf8");
  return /^\*\*Supported runtime:\*\* `([^`]+)`$/m.exec(text)?.[1];
}

/** The flow-reel installed for the script (or the current folder): the nearest node_modules/flow-reel upward. */
function installedVersion(from) {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const pkg = join(dir, "node_modules/flow-reel/package.json");
    if (existsSync(pkg)) return { version: JSON.parse(readFileSync(pkg, "utf8")).version, where: pkg };
    if (dirname(dir) === dir) return undefined;
  }
}

/** Each cloud voice's default key variable; `openai-compatible` has none. */
const CLOUD_KEYS = { openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", openrouter: "OPENROUTER_API_KEY",
  together: "TOGETHER_API_KEY", groq: "GROQ_API_KEY", elevenlabs: "ELEVENLABS_API_KEY", "openai-compatible": undefined };

/** The workspace's flow-reel.json: the nearest one upward, as flow-reel itself looks for it. */
function findWorkspace(from) {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const file = join(dir, "flow-reel.json");
    if (existsSync(file)) {
      try { return { file, config: JSON.parse(readFileSync(file, "utf8")) }; }
      catch (error) { return { file, error: error.message }; }
    }
    if (dirname(dir) === dir) return undefined;
  }
}

function checkWorkspace(found) {
  if (!found) return { status: "fail", detail: "no flow-reel.json here or above: not a workspace", fix: "npx flow-reel init --title <title>, at the project's root" };
  if (found.error) return { status: "fail", detail: `${found.file} can't be read: ${found.error}` };
  if (found.config?.version === 1) {
    return { status: "fail", detail: `${found.file} is from before flow-reel 0.8`,
      fix: "npx flow-reel init, at the project's root, takes it over and prints the git mv lines for its scripts" };
  }
  return { status: "ok", detail: `${found.config?.workspace?.title} (${found.file}); scripts in ${found.config?.scripts}, reels in ${found.config?.output}` };
}

/** The workspace's voice, and whether its key is set; never reads or prints the key's value. */
function checkVoice(config) {
  const voice = config?.voice ?? {};
  const adapter = voice.adapter ?? "qwen3-tts-0.6b";
  if (!(adapter in CLOUD_KEYS)) return { status: "ok", detail: `${adapter}: a local voice (CPU, about a minute per comment)` };
  if ("apiKey" in voice) {
    return { status: "fail", detail: "flow-reel.json holds a key (voice.apiKey), which flow-reel refuses",
      fix: "remove it, put the key in an environment variable, and name the variable in voice.apiKeyEnv" };
  }
  const variable = voice.apiKeyEnv ?? CLOUD_KEYS[adapter];
  if (!variable) return { status: "ok", detail: `${adapter} at ${voice.baseUrl ?? "(no baseUrl)"}, with no key` };
  return process.env[variable]
    ? { status: "ok", detail: `${adapter}, key in ${variable}` }
    : { status: "fail", detail: `${adapter} needs ${variable}, which isn't set here`,
      fix: `the person sets it in the shell that composes (export ${variable}=...); never in flow-reel.json` };
}

const probe = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", timeout: 15_000 });

async function checkUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return { status: "fail", detail: `${url} is not a URL` }; }
  if (!["http:", "https:"].includes(parsed.protocol)) return { status: "fail", detail: `${url} is not http or https` };
  try {
    const res = await fetch(parsed, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    if (res.status >= 300 && res.status < 400) {
      return { status: "note", detail: `${url} answers ${res.status}, redirecting to ${res.headers.get("location")}; ` +
        "if that is a login, the composer's fresh browser won't be signed in" };
    }
    if (res.status >= 400) return { status: "fail", detail: `${url} answers ${res.status}` };
    return { status: "ok", detail: `${url} answers ${res.status}` };
  } catch (error) {
    return { status: "fail", detail: `${url} doesn't answer (${error.cause?.code ?? error.cause?.errors?.[0]?.code ?? error.cause?.message ?? error.name}); start the app first` };
  }
}

export async function preflight(args) {
  const checks = [];
  const add = (name, result) => checks.push({ name, ...result });

  const [major, minor] = process.versions.node.split(".").map(Number);
  add("node", major > 22 || (major === 22 && minor >= 18)
    ? { status: "ok", detail: `Node ${process.versions.node}` }
    : { status: "fail", detail: `Node ${process.versions.node}; flow-reel needs >=22.18`, fix: "install Node 22.18 or later" });

  let engine;
  const installed = [];
  for (const command of ["docker", "podman"]) {
    if (probe(command, ["--version"]).status !== 0) continue;
    installed.push(command);
    if (probe(command, ["info"]).status === 0) { engine = command; break; }
  }
  if (engine) add("engine", { status: "ok", detail: `${engine} answers` });
  else if (installed.length) add("engine", { status: "fail", detail: `${installed.join(" and ")} installed but not answering`, fix: "start the engine (Docker Desktop, `systemctl start docker`, or `podman machine start`)" });
  else add("engine", { status: "fail", detail: "neither Docker nor Podman is on PATH", fix: "install Docker or Podman" });

  const range = supportedRange();
  const found = args.version ? { version: args.version, where: "--version" } : installedVersion(args.script ? dirname(args.script) : process.cwd());
  if (!found) {
    add("runtime", { status: "fail", detail: "no flow-reel installed here and no --version given", fix: "npm install --save-dev flow-reel" });
  } else if (!satisfies(found.version, range)) {
    add("runtime", { status: "fail", detail: `flow-reel ${found.version} (${found.where}); this plugin supports ${range}`, fix: "npm install --save-dev flow-reel, or update the plugin" });
  } else add("runtime", { status: "ok", detail: `flow-reel ${found.version}, within ${range}` });

  const workspace = findWorkspace(args.script ? dirname(args.script) : process.cwd());
  add("workspace", checkWorkspace(workspace));
  if (engine && found) {
    // A cloud voice composes in a smaller image of its own.
    const suffix = workspace?.config?.voice?.adapter in CLOUD_KEYS ? "-cloud" : "";
    const image = `ghcr.io/codeonym-oss/flow-reel:${found.version}${suffix}`;
    add("image", probe(engine, ["image", "inspect", image]).status === 0
      ? { status: "ok", detail: `${image} is present` }
      : { status: "note", detail: `${image} isn't present; the first compose pulls it (several GB), or builds it if it can't`, fix: `${engine} pull ${image}` });
  }

  add("voice", checkVoice(workspace?.config));

  if (args.script) {
    add("script", !existsSync(args.script)
      ? { status: "fail", detail: `${args.script} doesn't exist` }
      : !args.script.endsWith(".reel.ts")
        ? { status: "fail", detail: `${args.script} isn't named <name>.reel.ts`, fix: "rename it" }
        : { status: "ok", detail: `${args.script} exists` });
  }
  if (args.url) add("url", await checkUrl(args.url));
  return checks;
}

async function main() {
  const args = parse(process.argv.slice(2));
  if (!args) { console.error(USAGE); return 2; }
  if (args.help) { console.log(USAGE); return 0; }
  const checks = await preflight(args);
  if (args.json) console.log(JSON.stringify({ checks }, null, 2));
  else for (const c of checks) console.log(`${c.status.padEnd(4)} ${c.name}: ${c.detail}${c.fix ? `\n     fix: ${c.fix}` : ""}`);
  return checks.some((c) => c.status === "fail") ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();

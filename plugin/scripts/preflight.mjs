#!/usr/bin/env node
// Checks what `flow-reel compose` needs, and changes nothing (GH-6 decision 009): Node, an engine whose daemon
// answers, a runtime the plugin supports, the composer image, the script, and the app's URL.
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

/** The one range form the plugin states: `>=A.B.C <X.Y.Z`. */
export function satisfies(version, range) {
  const match = /^>=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)$/.exec(range);
  if (!match || !/^\d+\.\d+\.\d+/.test(version)) return false;
  const parts = (v) => v.split(/[-+]/)[0].split(".").map(Number);
  const cmp = (a, b) => {
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  return cmp(version, match[1]) >= 0 && cmp(version, match[2]) < 0;
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
    add("runtime", { status: "fail", detail: "no flow-reel installed here and no --version given", fix: "npm install --save-dev flow-reel@0.2" });
  } else if (!satisfies(found.version, range)) {
    add("runtime", { status: "fail", detail: `flow-reel ${found.version} (${found.where}); this plugin supports ${range}`, fix: "install a supported flow-reel, or update the plugin" });
  } else add("runtime", { status: "ok", detail: `flow-reel ${found.version}, within ${range}` });

  if (engine && found) {
    const image = `ghcr.io/codeonym-oss/flow-reel:${found.version}`;
    add("image", probe(engine, ["image", "inspect", image]).status === 0
      ? { status: "ok", detail: `${image} is present` }
      : { status: "note", detail: `${image} isn't present; the first compose pulls it (several GB), or builds it if it can't`, fix: `${engine} pull ${image}` });
  }

  if (args.script) {
    add("script", existsSync(args.script)
      ? { status: "ok", detail: `${args.script} exists` }
      : { status: "fail", detail: `${args.script} doesn't exist` });
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

// The host side of `flow-reel record` (story decision 008): find an engine, get the image matching this package's
// version (GH-2 decision 004), and run the recording in it with the script's folder mounted.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Engine = "docker" | "podman";

export interface RunArgsInput {
  engine: Engine;
  /** Docker Desktop (macOS, Windows/WSL2): no host network, so localhost is mapped instead (GH-2 decision 003). */
  desktop: boolean;
  image: string;
  workDir: string;
  script: string;
  uid: number;
  gid: number;
}

export const imageFor = (version: string) => `ghcr.io/codeonym-oss/flow-reel:${version}`;

export function buildRunArgs(i: RunArgsInput): string[] {
  return [
    "run", "--rm", "--init", "--shm-size=1g",
    "-v", `${i.workDir}:/work`, "-w", "/work",
    ...(i.engine === "podman" ? ["--userns=keep-id"] : ["--user", `${i.uid}:${i.gid}`]),
    ...(i.desktop ? ["-e", "FLOW_REEL_HOST_MAP=1"] : ["--network", "host"]),
    i.image, "record", `/work/${i.script}`,
  ];
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function run(cmd: string, args: string[], inherit = false) {
  return spawnSync(cmd, args, { stdio: inherit ? "inherit" : "pipe", encoding: "utf8" });
}

function detectEngine(): Engine {
  for (const engine of ["docker", "podman"] as const) {
    if (run(engine, ["--version"]).status === 0) return engine;
  }
  throw new Error("flow-reel needs Docker or Podman: neither was found on PATH");
}

function ensureImage(engine: Engine, image: string) {
  if (run(engine, ["image", "inspect", image]).status === 0) return;
  if (run(engine, ["pull", image], true).status === 0) return;
  console.error(`flow-reel: ${image} can't be pulled; building it locally (once).`);
  const built = run(engine, ["build", "-t", image, "-f", resolve(packageRoot, "docker/Dockerfile"), packageRoot], true);
  if (built.status !== 0) throw new Error(`building ${image} failed`);
}

/** Runs the recording in the container; resolves to its exit code. */
export function launch(scriptPath: string): number {
  const engine = detectEngine();
  const { version } = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { version: string };
  const image = imageFor(version);
  ensureImage(engine, image);
  const desktop = process.platform !== "linux"
    || run(engine, ["info", "--format", "{{.OperatingSystem}}"]).stdout.includes("Docker Desktop");
  const script = resolve(scriptPath);
  const args = buildRunArgs({
    engine, desktop, image, workDir: dirname(script), script: basename(script),
    uid: process.getuid?.() ?? 1000, gid: process.getgid?.() ?? 1000,
  });
  return run(engine, args, true).status ?? 1;
}

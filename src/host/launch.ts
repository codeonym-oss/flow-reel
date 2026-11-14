// The host side of `flow-reel record` (story decision 008): find an engine, get the image matching this package's
// version (GH-2 decision 004), and run the recording in it with the script's folder mounted.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
  sfx?: boolean;
}

export const imageFor = (version: string) => `ghcr.io/codeonym-oss/flow-reel:${version}`;

export function buildRunArgs(i: RunArgsInput): string[] {
  return [
    "run", "--rm", "--init", "--shm-size=1g",
    "-v", `${i.workDir}:/work`, "-w", "/work",
    ...(i.engine === "podman" ? ["--userns=keep-id"] : ["--user", `${i.uid}:${i.gid}`]),
    ...(i.desktop ? ["-e", "FLOW_REEL_HOST_MAP=1"] : ["--network", "host"]),
    i.image, "record", `/work/${i.script}`, ...(i.sfx === false ? ["--no-sfx"] : []),
  ];
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function run(cmd: string, args: string[], inherit = false) {
  return spawnSync(cmd, args, { stdio: inherit ? "inherit" : "pipe", encoding: "utf8" });
}

export interface DetectedEngine {
  /** The command to run. */
  command: Engine;
  /** What actually answers it: podman-docker installs a `docker` command that runs Podman. */
  engine: Engine;
}

type Probe = (cmd: string, args: string[]) => { status: number | null; stdout: string };

/** The first installed engine whose daemon answers; a clear error when one is installed but not running. */
export function detectEngine(probe: Probe = run): DetectedEngine {
  const installed: Engine[] = [];
  for (const command of ["docker", "podman"] as const) {
    const version = probe(command, ["--version"]);
    if (version.status !== 0) continue;
    installed.push(command);
    if (probe(command, ["info"]).status === 0) {
      return { command, engine: /podman/i.test(version.stdout ?? "") ? "podman" : command };
    }
  }
  if (installed.length) {
    throw new Error(`${installed.join(" and ")} ${installed.length > 1 ? "are" : "is"} installed but not responding: ` +
      "start the engine (e.g. Docker Desktop, `systemctl start docker`, or `podman machine start`) and try again");
  }
  throw new Error("flow-reel needs Docker or Podman: neither was found on PATH");
}

/** A git checkout of flow-reel records with the released image of its version, not with its own source. */
export function sourceCheckoutWarning(root: string, image: string): string | undefined {
  if (!existsSync(resolve(root, ".git")) || !existsSync(resolve(root, "src/runner"))) return undefined;
  return `flow-reel: running from a source checkout; recording uses ${image}, whose runner may differ from this ` +
    `checkout's src/. To record with local changes: npm run build && docker build -t ${image} -f docker/Dockerfile .`;
}

function ensureImage(engine: Engine, image: string) {
  if (run(engine, ["image", "inspect", image]).status === 0) return;
  if (run(engine, ["pull", image], true).status === 0) return;
  console.error(`flow-reel: ${image} can't be pulled; building it locally (once).`);
  const built = run(engine, ["build", "-t", image, "-f", resolve(packageRoot, "docker/Dockerfile"), packageRoot], true);
  if (built.status !== 0) throw new Error(`building ${image} failed`);
}

/** Runs the recording in the container; resolves to its exit code. */
export function launch(scriptPath: string, options: { sfx?: boolean } = {}): number {
  const { command, engine } = detectEngine();
  const { version } = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { version: string };
  const image = imageFor(version);
  const warning = sourceCheckoutWarning(packageRoot, image);
  if (warning) console.warn(warning);
  ensureImage(command, image);
  const desktop = process.platform !== "linux"
    || run(command, ["info", "--format", "{{.OperatingSystem}}"]).stdout.includes("Docker Desktop");
  const script = resolve(scriptPath);
  const args = buildRunArgs({
    engine, desktop, image, workDir: dirname(script), script: basename(script),
    uid: process.getuid?.() ?? 1000, gid: process.getgid?.() ?? 1000, sfx: options.sfx,
  });
  return run(command, args, true).status ?? 1;
}

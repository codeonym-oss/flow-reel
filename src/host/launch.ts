// The host side of `flow-reel compose` (story decision 008): find an engine, get the image matching this package's
// version (GH-2 decision 004), and run the recording in it with the script's folder mounted.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_FILE, KNOWN, type Settings, type SettingsFlags, credentialsFor, readConfig, resolveSettings, settingsFlags,
  writeConfig } from "../settings.ts";

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
  sound?: boolean;
  /** An absolute folder for the reel, mounted at /out. */
  outDir?: string;
  /** The resolved settings, passed to the composer as flags. */
  settings: Settings;
  /** Environment variables the adapters need: passed by name, so the engine reads each value from this environment. */
  credentials?: string[];
}

/** The Dockerfile's targets: `cloud` has no local voice, `full` has it (GH-101 decisions 001 and 002). */
export type ImageTarget = "cloud" | "full";

/** The image a voice needs: a cloud voice runs at its provider, so it doesn't need the local voice's files. */
export const targetFor = (voice: string): ImageTarget => (KNOWN.voices[voice].cloud ? "cloud" : "full");

export const imageFor = (version: string, target: ImageTarget) =>
  `ghcr.io/codeonym-oss/flow-reel:${version}${target === "cloud" ? "-cloud" : ""}`;

export function buildRunArgs(i: RunArgsInput): string[] {
  return [
    "run", "--rm", "--init", "--shm-size=1g",
    "-v", `${i.workDir}:/work`, "-w", "/work",
    ...(i.outDir ? ["-v", `${i.outDir}:/out`] : []),
    ...(i.engine === "podman" ? ["--userns=keep-id"] : ["--user", `${i.uid}:${i.gid}`]),
    ...(i.desktop ? ["-e", "FLOW_REEL_HOST_MAP=1"] : ["--network", "host"]),
    ...(i.credentials ?? []).flatMap((name) => ["-e", name]),
    i.image, "compose", `/work/${i.script}`, ...(i.sound === false ? ["--no-sound"] : []),
    ...(i.outDir ? ["--out", "/out"] : []), ...settingsFlags(i.settings),
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
export function sourceCheckoutWarning(root: string, image: string, target: ImageTarget): string | undefined {
  if (!existsSync(resolve(root, ".git")) || !existsSync(resolve(root, "src/composer"))) return undefined;
  return `flow-reel: running from a source checkout; recording uses ${image}, whose composer may differ from this ` +
    `checkout's src/. To record with local changes: npm run build && docker build --target ${target} -t ${image} ` +
    "-f docker/Dockerfile .";
}

function ensureImage(engine: Engine, image: string, target: ImageTarget) {
  if (run(engine, ["image", "inspect", image]).status === 0) return;
  if (run(engine, ["pull", image], true).status === 0) return;
  console.error(`flow-reel: ${image} can't be pulled; building it locally (once).`);
  const built = run(engine, ["build", "--target", target, "-t", image,
    "-f", resolve(packageRoot, "docker/Dockerfile"), packageRoot], true);
  if (built.status !== 0) throw new Error(`building ${image} failed`);
}

export interface LaunchOptions { sound?: boolean; outDir?: string; flags?: SettingsFlags; saveConfig?: boolean }

/**
 * Writes the settings to the script folder's flow-reel.json after a successful compose, when there is none or with
 * --save-config (GH-33 decisions 001 and 005). Returns whether it wrote.
 */
export function saveSettings(status: number, dir: string, settings: Settings, rewrite: boolean): boolean {
  if (status !== 0 || !rewrite) return false;
  writeConfig(dir, settings);
  console.error(`flow-reel: saved the settings in ${CONFIG_FILE}`);
  return true;
}

/** Runs the recording in the container; resolves to its exit code. */
export function launch(scriptPath: string, options: LaunchOptions = {}): number {
  const script = resolve(scriptPath);
  const config = readConfig(dirname(script));
  const settings = resolveSettings(config, options.flags);
  const credentials = credentialsFor(settings, process.env);
  const { command, engine } = detectEngine();
  const { version } = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { version: string };
  const target = targetFor(settings.voice.adapter);
  const image = imageFor(version, target);
  const warning = sourceCheckoutWarning(packageRoot, image, target);
  if (warning) console.warn(warning);
  ensureImage(command, image, target);
  const desktop = process.platform !== "linux"
    || run(command, ["info", "--format", "{{.OperatingSystem}}"]).stdout.includes("Docker Desktop");
  // Created here, so the engine doesn't create the mount point as root.
  const outDir = options.outDir === undefined ? undefined : resolve(options.outDir);
  if (outDir) mkdirSync(outDir, { recursive: true });
  const args = buildRunArgs({
    engine, desktop, image, workDir: dirname(script), script: basename(script),
    uid: process.getuid?.() ?? 1000, gid: process.getgid?.() ?? 1000, sound: options.sound, outDir, settings, credentials,
  });
  const status = run(command, args, true).status ?? 1;
  saveSettings(status, dirname(script), settings, !config || Boolean(options.saveConfig));
  return status;
}

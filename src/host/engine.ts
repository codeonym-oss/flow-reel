// The container engine on this computer, and the composer image matching this package's version (GH-2 decision 004).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWN } from "../settings.ts";

export type EngineName = "docker" | "podman";

export interface Engine {
  /** The command to run. */
  command: EngineName;
  /** What actually answers it: podman-docker installs a `docker` command that runs Podman. */
  kind: EngineName;
  /** Docker Desktop (macOS, Windows/WSL2): no host network, so localhost is mapped instead (GH-2 decision 003). */
  desktop: boolean;
}

/** The Dockerfile's targets: `cloud` has no local voice, `full` has it (GH-101 decisions 001 and 002). */
export type ImageTarget = "cloud" | "full";

/** The image a voice needs: a cloud voice runs at its provider, so it doesn't need the local voice's files. */
export const targetFor = (voice: string): ImageTarget => (KNOWN.voices[voice].cloud ? "cloud" : "full");

export const imageFor = (version: string, target: ImageTarget) =>
  `ghcr.io/codeonym-oss/flow-reel:${version}${target === "cloud" ? "-cloud" : ""}`;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const packageVersion = (): string =>
  (JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { version: string }).version;

function run(cmd: string, args: string[], inherit = false) {
  // What an engine says while it pulls or builds is progress, so it goes to the error output.
  return spawnSync(cmd, args, { stdio: inherit ? ["ignore", 2, 2] : "pipe", encoding: "utf8" });
}

type Probe = (cmd: string, args: string[]) => { status: number | null; stdout: string };

/** The first installed engine whose daemon answers; a clear error when one is installed but not running. */
export function detectEngine(probe: Probe = run, platform: NodeJS.Platform = process.platform): Engine {
  const installed: EngineName[] = [];
  for (const command of ["docker", "podman"] as const) {
    const version = probe(command, ["--version"]);
    if (version.status !== 0) continue;
    installed.push(command);
    if (probe(command, ["info"]).status !== 0) continue;
    const kind = /podman/i.test(version.stdout ?? "") ? "podman" : command;
    const desktop = platform !== "linux" || (probe(command, ["info", "--format", "{{.OperatingSystem}}"]).stdout ?? "").includes("Docker Desktop");
    return { command, kind, desktop };
  }
  if (installed.length) {
    throw new Error(`${installed.join(" and ")} ${installed.length > 1 ? "are" : "is"} installed but not responding: ` +
      "start the engine (e.g. Docker Desktop, `systemctl start docker`, or `podman machine start`) and try again");
  }
  throw new Error("flow-reel needs Docker or Podman: neither was found on PATH");
}

/** A git checkout of flow-reel composes with the released image of its version, not with its own source. */
export function sourceCheckoutWarning(root: string, image: string, target: ImageTarget): string | undefined {
  if (!existsSync(resolve(root, ".git")) || !existsSync(resolve(root, "src/composer"))) return undefined;
  return `running from a source checkout; composing uses ${image}, whose composer may differ from this checkout's src/. ` +
    `To compose with local changes: npm run build && docker build --target ${target} -t ${image} -f docker/Dockerfile .`;
}

/** An engine command's exit status, without holding up the process: the studio's server shares it (GH-147). */
function runAside(cmd: string, args: string[], inherit = false): Promise<number | null> {
  return new Promise((done) => {
    const child = spawn(cmd, args, { stdio: inherit ? ["ignore", 2, 2] : "ignore" });
    child.on("error", () => done(null));
    child.on("close", (status) => done(status));
  });
}

/** Makes sure the image is on this computer: pulled, or built when it can't be. Returns its name. */
export async function ensureImage(engine: Engine, version: string, target: ImageTarget, say: (message: string) => void): Promise<string> {
  const image = imageFor(version, target);
  const warning = sourceCheckoutWarning(packageRoot, image, target);
  if (warning) say(warning);
  if (await runAside(engine.command, ["image", "inspect", image]) === 0) return image;
  if (await runAside(engine.command, ["pull", image], true) === 0) return image;
  say(`${image} can't be pulled; building it locally (once).`);
  const built = await runAside(engine.command, ["build", "--target", target, "-t", image,
    "-f", resolve(packageRoot, "docker/Dockerfile"), packageRoot], true);
  if (built !== 0) throw new Error(`building ${image} failed`);
  return image;
}

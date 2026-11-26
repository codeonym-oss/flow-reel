// Runs one phase of a run in a container (GH-108 decision 011): it sees only what the phase reads, says what it does as
// JSON lines, and ends when this process does.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { type ContainerMessage, type ContainerRequest, MOUNTS, READS, lineReader, messageReader } from "../container/protocol.ts";
import type { PhaseProgress } from "../composer/progress.ts";
import { KNOWN } from "../settings.ts";
import type { Engine } from "./engine.ts";
import type { Screen } from "./screen.ts";

export interface PhaseContainer {
  engine: Engine;
  image: string;
  /** The container's name, unique on this computer. */
  name: string;
  /** The run's folder. */
  runDir: string;
  /** The folder the phase writes to. */
  out: string;
  request: ContainerRequest;
  /** Environment variables the voice needs: passed by name, so the engine reads each value from this environment. */
  credentials: readonly string[];
  uid: number;
  gid: number;
}

/** Rendering needs no network; recording needs the app's, and speaking a cloud voice's provider. */
const offline = (request: ContainerRequest) =>
  request.phase === "render" || (request.phase === "voice" && !KNOWN.voices[request.voice.adapter].cloud);

export function containerArgs({ engine, image, name, runDir, out, request, credentials, uid, gid }: PhaseContainer): string[] {
  return [
    "run", "--rm", "--init", "--interactive", "--shm-size=1g", "--name", name,
    ...READS[request.phase].flatMap((mount) => ["-v", `${join(runDir, mount)}:${MOUNTS[mount]}:ro`]),
    "-v", `${out}:${MOUNTS.out}`,
    ...(engine.kind === "podman" ? ["--userns=keep-id"] : ["--user", `${uid}:${gid}`]),
    ...(offline(request) ? ["--network", "none"] : engine.desktop ? ["-e", "FLOW_REEL_HOST_MAP=1"] : ["--network", "host"]),
    ...(request.phase === "voice" ? credentials.flatMap((credential) => ["-e", credential]) : []),
    image, JSON.stringify(request),
  ];
}

export interface PhaseHooks {
  report(progress: PhaseProgress): void;
  /** Who watches the recording's screen, for the live picture. */
  screen?: Screen;
  /** A line the container printed that isn't a message: diagnostics, a script's own output. */
  log(line: string): void;
  /** Ends the container early. */
  signal?: AbortSignal;
}

const GRACE_MS = 5000;

/** Runs the phase; resolves when it finished, and rejects with what it said went wrong. */
export function runContainer(phase: PhaseContainer, { report, log, signal, screen }: PhaseHooks): Promise<void> {
  const { engine, name } = phase;
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(engine.command, containerArgs(phase), { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let failure: string | undefined;
    const messages = messageReader((message: ContainerMessage) => {
      if (message.type === "failed") failure = message.message;
      else if (message.type === "picture") screen?.picture(message.jpeg);
      else report(message);
    }, log);
    const diagnostics = lineReader(log);
    let last = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => messages.push(chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { last = (last + chunk).slice(-2000); diagnostics.push(chunk); });
    // Closing its input tells the container to end; one that doesn't is removed.
    const stop = () => {
      child.stdin.end();
      setTimeout(() => { spawn(engine.command, ["rm", "--force", name], { stdio: "ignore", windowsHide: true }).on("error", () => {}); }, GRACE_MS).unref();
      // An engine that doesn't answer doesn't keep the run from ending.
      setTimeout(() => child.kill("SIGKILL"), 2 * GRACE_MS).unref();
    };
    signal?.addEventListener("abort", stop, { once: true });
    const detach = phase.request.phase === "record" ? screen?.attach((input) => { if (child.stdin.writable) child.stdin.write(`${input}\n`); }) : undefined;
    child.stdin.on("error", () => {}); // the container is gone; its exit says so
    child.once("error", (error) => reject(new Error(`${engine.command} could not start: ${error.message}`, { cause: error })));
    child.once("close", (code, killed) => {
      signal?.removeEventListener("abort", stop);
      detach?.();
      messages.end();
      diagnostics.end();
      if (signal?.aborted) reject(signal.reason as Error);
      else if (code === 0) resolve();
      else reject(new Error(failure ?? `the ${phase.request.phase} container ended unexpectedly (${killed ?? `exit ${code}`})${last.trim() ? `:\n${last.trim()}` : ""}`));
    });
  });
}

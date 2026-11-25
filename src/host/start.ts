// Starts a run's own process (epic GH-107 decision 023): it doesn't end with the command, the terminal or the login that
// started it, and it keeps the voice's key in its environment only.
import { type ChildProcess, spawn } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import { rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Engine } from "./engine.ts";
import { JOURNAL_FILE } from "./journal.ts";
import { type Run, logFile } from "./run-folder.ts";

/** What a run's process works with. */
export interface Tools { engine: Engine; image: string }

/** What a run's process tells the one that started it, once. */
export type StartMessage = { type: "started" } | { type: "failed"; message: string };

const PROGRAM = join(fileURLToPath(new URL(".", import.meta.url)), `run-process${extname(fileURLToPath(import.meta.url))}`);

/** Resolves once the run's process owns it; a run that couldn't be started leaves nothing. */
export async function startProcess(run: Run, tools: Tools, program: string = PROGRAM): Promise<void> {
  const dir = resolve(run.dir);
  try {
    const log = openSync(logFile(dir), "a");
    let child: ChildProcess;
    try {
      child = spawn(process.execPath, [program, dir, JSON.stringify(tools)],
        { detached: true, windowsHide: true, cwd: dir, stdio: ["ignore", log, log, "ipc"] });
    } finally { closeSync(log); }
    const exited = new Promise<StartMessage>((done, fail) => {
      child.once("error", fail)
        .once("exit", (code) => done({ type: "failed", message: `its process ended before it started (exit ${code})` }));
    });
    const message = await Promise.race([exited, new Promise<StartMessage>((done) => child.once("message", (message) => done(message as StartMessage)))]);
    if (message.type === "failed") {
      await exited; // it holds the run's folder until then
      throw new Error(`the run couldn't start: ${message.message}`);
    }
    // Only this side closes the channel: a process that closes one the other end has closed dies of it.
    child.disconnect();
    child.unref();
  } catch (error) {
    if (!existsSync(join(dir, JOURNAL_FILE))) await rm(dir, { recursive: true, force: true, maxRetries: 10 });
    throw error;
  }
}

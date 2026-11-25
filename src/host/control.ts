// The local socket a run's process takes commands on (GH-108 decision 011): a Unix socket in a folder only the person can
// open, or a named pipe on Windows. The run's folder holds its address and a token, so whoever can't read the folder can't
// command the run.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { type Socket, connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { lineReader } from "../container/protocol.ts";
import { type Command, answerLine, commandLine, readAnswer, readCommand } from "../run/control.ts";
import { writePrivate } from "./files.ts";

const CONTROL_FILE = "control.json";
const LONGEST_LINE = 64 * 1024;
const ANSWER_MS = 10_000;

interface Control { address: string; token: string }

function addressFor(runDir: string): string {
  const name = createHash("sha256").update(resolve(runDir)).digest("hex").slice(0, 16);
  if (process.platform === "win32") return `\\\\.\\pipe\\flow-reel-${name}`;
  // Not in the run's folder: a Unix socket's path can't be longer than about 100 bytes.
  const uid = process.getuid!();
  const runtime = process.env.XDG_RUNTIME_DIR;
  const dir = join(runtime && existsSync(runtime) ? runtime : tmpdir(), `flow-reel-${uid}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.uid !== uid || stat.mode & 0o077) throw new Error(`${dir} must be a folder only you can open: remove it and try again`);
  return join(dir, `${name}.sock`);
}

/** Takes commands for a run until it is closed. `handle` throws to refuse one. Only the run's owner may listen. */
export async function listen(runDir: string, handle: (command: Command) => void): Promise<{ close(): void }> {
  const address = addressFor(runDir);
  const token = randomBytes(16).toString("hex");
  // A process that was killed leaves its socket behind.
  if (process.platform !== "win32") rmSync(address, { force: true });
  const open = new Set<Socket>();
  const server = createServer((socket) => {
    open.add(socket);
    socket.on("close", () => open.delete(socket)).on("error", () => {});
    let unread = 0;
    const lines = lineReader((line) => {
      let answer: Parameters<typeof answerLine>[0] = { ok: true };
      try { handle(readCommand(line, token)); }
      catch (error) { answer = { ok: false, error: (error as Error).message }; }
      socket.write(answerLine(answer));
    });
    socket.setEncoding("utf8").on("data", (chunk: string) => {
      unread = chunk.includes("\n") ? chunk.length - chunk.lastIndexOf("\n") : unread + chunk.length;
      if (unread > LONGEST_LINE) socket.destroy();
      else lines.push(chunk);
    });
  });
  await new Promise<void>((done, fail) => { server.once("error", fail).listen(address, done); });
  const file = join(runDir, CONTROL_FILE);
  writePrivate(file, JSON.stringify({ address, token } satisfies Control));
  return { close() {
    rmSync(file, { force: true });
    for (const socket of open) socket.destroySoon();
    server.close();
  } };
}

/** The run's process isn't there to take a command. */
export class NotListening extends Error {}

/** Sends a command to a run's process and waits for its answer; throws why it is refused, or NotListening. */
export async function sendCommand(runDir: string, command: Command): Promise<void> {
  let control: Control;
  try { control = JSON.parse(readFileSync(join(runDir, CONTROL_FILE), "utf8")) as Control; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new NotListening("it isn't running");
    throw error;
  }
  const answer = await new Promise<ReturnType<typeof readAnswer>>((done, fail) => {
    const socket = connect(control.address);
    const lines = lineReader((line) => {
      socket.destroy();
      try { done(readAnswer(line)); } catch (error) { fail(error as Error); }
    });
    socket.setEncoding("utf8").setTimeout(ANSWER_MS)
      .on("connect", () => socket.write(commandLine(command, control.token)))
      .on("data", (chunk: string) => lines.push(chunk))
      .on("timeout", () => socket.destroy(new Error("its process doesn't answer")))
      .on("error", (error: NodeJS.ErrnoException) => fail(["ENOENT", "ECONNREFUSED", "ECONNRESET", "EPIPE"].includes(error.code ?? "")
        ? new NotListening("it isn't running", { cause: error }) : error))
      .on("close", () => fail(new NotListening("it ended")));
  });
  if (!answer.ok) throw new Error(answer.error);
}

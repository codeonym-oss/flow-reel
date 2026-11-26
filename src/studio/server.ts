// The studio's server (epic GH-107 decision 027): the web app's files, its API and its WebSockets, on 127.0.0.1 only,
// behind the locks (GH-109 decision 010).
import { createReadStream, existsSync, statSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import type { Duplex } from "node:stream";
import { type AddWorkspace, type Hello, type ClientMessage, type OnSaveSwitch, type Problem, type ResumeRun, type Score, STUDIO_API_VERSION, type ServerMessage, type StartRun,
  type StartedRun } from "./api.ts";
import { type Verdict, check as checkLock } from "./locks.ts";
import { type Connection, accept, isUpgrade } from "./websocket.ts";
import { startCompose } from "../host/new-run.ts";
import { trackedRuns } from "../host/tracker.ts";
import type { Entry } from "../run/journal.ts";
import { type RunState, isEnded } from "../run/machine.ts";
import { findScript } from "../workspace/workspace.ts";
import { sendCommand, watchPictures } from "../host/control.ts";
import { newestOnly } from "../host/screen.ts";
import { resumeRun } from "../host/new-run.ts";
import { runState } from "../host/owner.ts";
import { scoreOf, stepPicture } from "../host/score.ts";
import { type FoundRun, findRun, followRun, liveRun, logTail } from "./live.ts";
import { OnSave } from "./on-save.ts";
import { openScript, scriptOf, scripts, source, workspaceOf } from "./scripts.ts";
import { Refused, addWorkspace, clean, cleanPreview, runs, today, workspaces } from "./workspaces.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".json": "application/json",
};

/** Every response says: nothing from another site, and no framing by one. */
const HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

export interface Studio {
  /** The address to open, with the key. */
  url: string;
  port: number;
  close(): Promise<void>;
}

export interface StudioOptions {
  port: number;
  key: string;
  /** The built web app: `dist/web/`. */
  web: string;
  /** flow-reel's data folder on this computer. */
  data: string;
  /** Starts a run of a script file; `compose --detach`'s way unless a test gives another. */
  start?: (data: string, file: string) => Promise<StartedRun>;
  /** Lets an ended run go on; `resume --detach`'s way unless a test gives another. */
  resume?: (found: FoundRun, state: RunState) => Promise<void>;
  version: string;
}

function refuse(response: ServerResponse, verdict: Exclude<Verdict, { allow: true }>) {
  if (verdict.status === 303) {
    response.writeHead(303, { ...HEADERS, Location: verdict.location, "Set-Cookie": verdict.setCookie }).end();
  } else {
    response.writeHead(verdict.status, { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" }).end(`flow-reel studio: ${verdict.reason}\n`);
  }
}

const json = (response: ServerResponse, value: unknown, status = 200) =>
  response.writeHead(status, { ...HEADERS, "Content-Type": "application/json" }).end(JSON.stringify(value));

const problem = (response: ServerResponse, status: number, error: string) => json(response, { error } satisfies Problem, status);

/** The longest body a change may send. */
const LONGEST_BODY = 64 * 1024;

/** A change's JSON body (GH-135 decision 002); a Refused when it isn't JSON or is too long. */
async function body(request: IncomingMessage): Promise<unknown> {
  if (!/^application\/json\s*(;|$)/i.test(request.headers["content-type"] ?? "")) throw new Refused(415, "a change is sent as JSON");
  const pieces: Buffer[] = [];
  let length = 0;
  for await (const piece of request as AsyncIterable<Buffer>) {
    length += piece.length;
    if (length > LONGEST_BODY) throw new Refused(413, "that change is too long");
    pieces.push(piece);
  }
  try { return JSON.parse(Buffer.concat(pieces).toString("utf8")); } catch { throw new Refused(400, "that change isn't JSON"); }
}

const text = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value) throw new Refused(400, `${name} is missing`);
  return value;
};

interface Context {
  data: string; version: string; onSave: OnSave; start: (file: string) => Promise<StartedRun>;
  resume: (found: FoundRun, state: RunState) => Promise<void>;
}

/** Sends a watched run's entries and state as they come, and takes its commands, until the socket closes (GH-137). */
function watchRun(found: FoundRun, connection: Connection, say: (message: ServerMessage) => void) {
  const stop = new AbortController();
  connection.onClose(() => stop.abort());
  const all: Entry[] = [];
  // While the run records, its live picture: binary messages, the newest only while the tab is busy (GH-138).
  let pictures: AbortController | undefined;
  const send = newestOnly<Buffer>((jpeg, sent) => connection.sendBinary(jpeg, sent));
  const picture = (state: RunState) => {
    const recording = state.state === "running" && state.phase === "record" && !state.waiting;
    if (recording && !pictures && !stop.signal.aborted) {
      const watching = pictures = new AbortController();
      // A run's process that isn't listening yet, or no more, ends this watch; the next state starts another one.
      watchPictures(found.run.dir, send, AbortSignal.any([watching.signal, stop.signal]))
        .catch(() => {}).finally(() => { if (pictures === watching) pictures = undefined; });
    } else if (!recording && pictures) { pictures.abort(); pictures = undefined; }
  };
  followRun(found.run.dir, async (entries, state) => {
    all.push(...entries);
    if (state) picture(state);
    say({ v: STUDIO_API_VERSION, type: "entries", entries });
    say({ v: STUDIO_API_VERSION, type: "run", run: await liveRun(found, state, all) });
  }, stop.signal).catch((error: Error) => { say({ v: STUDIO_API_VERSION, type: "problem", error: error.message }); connection.close(1011); });
  connection.onText((text) => {
    let message: Partial<ClientMessage>;
    try { message = JSON.parse(text) as Partial<ClientMessage>; } catch { return connection.close(1003, "not JSON"); }
    if (message.type !== "cancel") return;
    sendCommand(found.run.dir, "cancel").catch((error: Error) =>
      say({ v: STUDIO_API_VERSION, type: "problem", error: `${found.id} can't be cancelled: ${error.message}` }));
  });
}

const startDetached = async (data: string, file: string): Promise<StartedRun> =>
  ({ id: (await startCompose(data, { path: file, say: () => {} })).id });

/** Whether the newest run of a script file is going on. */
function going(data: string, file: string): boolean {
  try {
    const { workspace, script } = findScript(file);
    const newest = trackedRuns(data, workspace.config.workspace.id).find((run) => run.script === script.name);
    return newest !== undefined && !isEnded(newest.state);
  } catch { return false; }
}

const flag = (value: unknown, name: string): boolean => {
  if (typeof value !== "boolean") throw new Refused(400, `${name} must be true or false`);
  return value;
};

/** The API's answer to a request, or undefined when no route has its path. */
async function api(request: IncomingMessage, url: URL, { data, version, onSave, start, resume }: Context): Promise<unknown> {
  const route = `${request.method === "HEAD" ? "GET" : request.method} ${url.pathname}`;
  switch (route) {
    case "GET /api/hello": return { v: STUDIO_API_VERSION, version } satisfies Hello;
    case "GET /api/workspaces": return workspaces(data);
    case "GET /api/runs": return runs(data);
    case "GET /api/today": {
      const since = Date.parse(url.searchParams.get("since") ?? "");
      return today(data, Number.isNaN(since) ? Date.now() - 24 * 3600_000 : since);
    }
    case "GET /api/clean": return cleanPreview(data, text(url.searchParams.get("workspace"), "workspace"));
    case "POST /api/clean": return clean(data, text((await body(request) as { workspace?: unknown })?.workspace, "workspace"));
    case "POST /api/workspaces": {
      const asked = await body(request) as Partial<AddWorkspace> | null;
      const title = asked?.init?.title;
      return addWorkspace(data, { path: text(asked?.path, "path"), ...(asked?.init ? { init: { title: text(title, "title") } } : {}) });
    }
    case "GET /api/scripts": return scripts(data, text(url.searchParams.get("workspace"), "workspace"), onSave);
    case "GET /api/script":
      return source(data, text(url.searchParams.get("workspace"), "workspace"), text(url.searchParams.get("name"), "name"));
    case "POST /api/scripts/open": return openScript(data, text((await body(request) as { path?: unknown })?.path, "path"));
    case "POST /api/runs": {
      const asked = await body(request) as Partial<StartRun> | null;
      const { workspace } = workspaceOf(data, text(asked?.workspace, "workspace"));
      const { file } = scriptOf(workspace, text(asked?.name, "name"));
      if (going(data, file)) throw new Refused(409, "a run of this script is going on: watch it, or cancel it first");
      try { return await start(file); } catch (error) { throw new Refused(400, (error as Error).message); }
    }
    case "POST /api/on-save": {
      const asked = await body(request) as Partial<OnSaveSwitch> | null;
      const { workspace } = workspaceOf(data, text(asked?.workspace, "workspace"));
      const { file } = scriptOf(workspace, text(asked?.name, "name"));
      onSave.set(file, flag(asked?.on, "on"));
      return { on: onSave.isOn(file) };
    }
    case "GET /api/log": return logTail(findRun(data, text(url.searchParams.get("run"), "run")).run.dir);
    case "GET /api/score": {
      const score: Score | undefined = scoreOf(findRun(data, text(url.searchParams.get("run"), "run")).run.dir);
      if (!score) throw new Refused(404, "this run has no recording yet");
      return score;
    }
    case "POST /api/runs/resume": {
      const found = findRun(data, text((await body(request) as Partial<ResumeRun> | null)?.run, "run"));
      const state = runState(found.run.dir);
      if (!state || !isEnded(state)) throw new Refused(409, `${found.id} is ${state?.state ?? "queued"}: only a run that ended can go on`);
      try { await resume(found, state); } catch (error) { throw new Refused(400, (error as Error).message); }
      return { id: found.id } satisfies StartedRun;
    }
    default: return undefined;
  }
}

/** The file a path names inside the web app, or its shell for a screen's path; undefined for anything else. */
function fileFor(web: string, pathname: string): string | undefined {
  let path: string;
  try { path = decodeURIComponent(pathname); } catch { return undefined; }
  const file = resolve(web, `.${path}`);
  if (file !== web && !file.startsWith(web + sep)) return undefined;
  if (existsSync(file) && statSync(file).isFile()) return file;
  // A screen's path, such as /run/saved-views/7: the shell routes it.
  return extname(path) === "" ? join(web, "index.html") : undefined;
}

const resumeDetached = (found: FoundRun, state: RunState) => resumeRun(found.id, found.run, state, { say: () => {} });

export async function startStudio({ port, key, web, data, version, start = startDetached, resume = resumeDetached }: StudioOptions): Promise<Studio> {
  const root = resolve(web);
  const onSave = new OnSave({ start: async (file) => { await start(data, file); }, going: (file) => going(data, file) });
  const context: Context = { data, version, onSave, start: (file) => start(data, file), resume };
  const check = (request: IncomingMessage) => checkLock({ method: request.method ?? "GET", url: request.url ?? "/",
    host: request.headers.host, origin: request.headers.origin, cookie: request.headers.cookie }, lock);
  const server = createServer((request, response) => {
    const verdict = check(request);
    if (!verdict.allow) return refuse(response, verdict);
    const url = new URL(request.url ?? "/", "http://studio");
    const { pathname } = url;
    // A step's picture is the one answer of the API that isn't JSON (GH-139 decision 003).
    if (pathname === "/api/step-picture" && request.method === "GET") {
      try {
        const step = Number(url.searchParams.get("step"));
        const file = stepPicture(findRun(data, text(url.searchParams.get("run"), "run")).run.dir, step);
        if (!file) throw new Refused(404, `step ${url.searchParams.get("step")} has no picture`);
        response.writeHead(200, { ...HEADERS, "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" });
        createReadStream(file).pipe(response);
      } catch (error) { problem(response, error instanceof Refused ? error.status : 500, (error as Error).message); }
      return;
    }
    if (pathname.startsWith("/api/")) {
      api(request, url, context).then(
        (answer) => answer === undefined ? problem(response, 404, `there is no ${request.method} ${pathname}`) : json(response, answer),
        (error: Error) => problem(response, error instanceof Refused ? error.status : 500, error.message));
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return response.writeHead(405, { ...HEADERS, Allow: "GET, HEAD" }).end();
    }
    const file = fileFor(root, pathname);
    if (!file || !existsSync(file)) return response.writeHead(404, HEADERS).end();
    response.writeHead(200, { ...HEADERS, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    if (request.method === "HEAD") return response.end();
    createReadStream(file).pipe(response);
  });
  // Upgraded sockets leave the server's own count: they are closed with it here.
  const upgraded = new Set<Duplex>();
  server.on("upgrade", (request: IncomingMessage, socket: Duplex) => {
    socket.on("error", () => {});
    upgraded.add(socket);
    socket.on("close", () => upgraded.delete(socket));
    const verdict = check(request);
    const { pathname } = new URL(request.url ?? "/", "http://studio");
    if (!verdict.allow || pathname !== "/ws" || !isUpgrade(request)) {
      const status = verdict.allow ? 400 : verdict.status === 303 ? 403 : verdict.status;
      return socket.end(`HTTP/1.1 ${status} Refused\r\nConnection: close\r\n\r\n`);
    }
    const asked = new URL(request.url ?? "/", "http://studio").searchParams.get("run");
    let found: FoundRun | undefined;
    if (asked !== null) {
      try { found = findRun(data, asked); } catch (error) {
        const status = error instanceof Refused ? error.status : 500;
        return socket.end(`HTTP/1.1 ${status} Refused\r\nConnection: close\r\n\r\n`);
      }
    }
    const connection = accept(request, socket);
    const say = (message: ServerMessage) => connection.sendText(JSON.stringify(message));
    if (!found) return say({ v: STUDIO_API_VERSION, type: "hello", version });
    watchRun(found, connection, say);
  });
  const lock = { port, key };
  await new Promise<void>((done, fail) => { server.once("error", fail).listen(port, "127.0.0.1", () => done()); });
  lock.port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${lock.port}/?key=${key}`,
    port: lock.port,
    close: () => new Promise((done) => {
      onSave.close();
      server.close(() => done());
      server.closeAllConnections();
      for (const socket of upgraded) socket.destroy();
    }),
  };
}

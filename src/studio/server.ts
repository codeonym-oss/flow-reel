// The studio's server (epic GH-107 decision 027): the web app's files, its API and its WebSockets, on 127.0.0.1 only,
// behind the locks (GH-109 decision 010).
import { createReadStream, existsSync, statSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import type { Duplex } from "node:stream";
import { type AddWorkspace, type Hello, type Problem, STUDIO_API_VERSION, type ServerMessage } from "./api.ts";
import { type Verdict, check } from "./locks.ts";
import { accept, isUpgrade } from "./websocket.ts";
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

/** The API's answer to a request, or undefined when no route has its path. */
async function api(request: IncomingMessage, url: URL, data: string, version: string): Promise<unknown> {
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

export async function startStudio({ port, key, web, data, version }: StudioOptions): Promise<Studio> {
  const root = resolve(web);
  const asked = (request: IncomingMessage) => check({ method: request.method ?? "GET", url: request.url ?? "/",
    host: request.headers.host, origin: request.headers.origin, cookie: request.headers.cookie }, lock);
  const server = createServer((request, response) => {
    const verdict = asked(request);
    if (!verdict.allow) return refuse(response, verdict);
    const url = new URL(request.url ?? "/", "http://studio");
    const { pathname } = url;
    if (pathname.startsWith("/api/")) {
      api(request, url, data, version).then(
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
    const verdict = asked(request);
    const { pathname } = new URL(request.url ?? "/", "http://studio");
    if (!verdict.allow || pathname !== "/ws" || !isUpgrade(request)) {
      const status = verdict.allow ? 400 : verdict.status === 303 ? 403 : verdict.status;
      return socket.end(`HTTP/1.1 ${status} Refused\r\nConnection: close\r\n\r\n`);
    }
    const connection = accept(request, socket);
    connection.sendText(JSON.stringify({ v: STUDIO_API_VERSION, type: "hello", version } satisfies ServerMessage));
  });
  const lock = { port, key };
  await new Promise<void>((done, fail) => { server.once("error", fail).listen(port, "127.0.0.1", () => done()); });
  lock.port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${lock.port}/?key=${key}`,
    port: lock.port,
    close: () => new Promise((done) => {
      server.close(() => done());
      server.closeAllConnections();
      for (const socket of upgraded) socket.destroy();
    }),
  };
}

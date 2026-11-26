// The studio's server (epic GH-107 decision 027): the web app's files, its API and its WebSockets, on 127.0.0.1 only,
// behind the locks (GH-109 decision 010).
import { createReadStream, existsSync, statSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import type { Duplex } from "node:stream";
import { STUDIO_API_VERSION, type Hello, type ServerMessage } from "./api.ts";
import { type Verdict, check } from "./locks.ts";
import { accept, isUpgrade } from "./websocket.ts";

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
  version: string;
}

function refuse(response: ServerResponse, verdict: Exclude<Verdict, { allow: true }>) {
  if (verdict.status === 303) {
    response.writeHead(303, { ...HEADERS, Location: verdict.location, "Set-Cookie": verdict.setCookie }).end();
  } else {
    response.writeHead(verdict.status, { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" }).end(`flow-reel studio: ${verdict.reason}\n`);
  }
}

const json = (response: ServerResponse, value: unknown) =>
  response.writeHead(200, { ...HEADERS, "Content-Type": "application/json" }).end(JSON.stringify(value));

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

export async function startStudio({ port, key, web, version }: StudioOptions): Promise<Studio> {
  const root = resolve(web);
  const asked = (request: IncomingMessage) => check({ method: request.method ?? "GET", url: request.url ?? "/",
    host: request.headers.host, origin: request.headers.origin, cookie: request.headers.cookie }, lock);
  const server = createServer((request, response) => {
    const verdict = asked(request);
    if (!verdict.allow) return refuse(response, verdict);
    const { pathname } = new URL(request.url ?? "/", "http://studio");
    if (request.method !== "GET" && request.method !== "HEAD") {
      return response.writeHead(405, { ...HEADERS, Allow: "GET, HEAD" }).end();
    }
    if (pathname === "/api/hello") return json(response, { v: STUDIO_API_VERSION, version } satisfies Hello);
    if (pathname.startsWith("/api/")) return response.writeHead(404, HEADERS).end();
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

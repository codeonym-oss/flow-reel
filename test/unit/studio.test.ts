import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { check, cookieName } from "../../src/studio/locks.ts";
import { type Studio, startStudio } from "../../src/studio/server.ts";
import { OP, ProtocolError, acceptKey, decodeFrames, encodeFrame } from "../../src/studio/websocket.ts";

/** A frame as a browser sends it: masked. */
function clientFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const mask = randomBytes(4);
  const masked = Buffer.from(payload.map((byte, i) => byte ^ mask[i & 3]!));
  const length = payload.length;
  const head = length < 126 ? Buffer.from([0, 0x80 | length])
    : length < 65_536 ? Buffer.from([0, 0x80 | 126, length >> 8, length & 0xff])
    : Buffer.concat([Buffer.from([0, 0x80 | 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(length)); return b; })()]);
  head[0] = (fin ? 0x80 : 0) | opcode;
  return Buffer.concat([head, mask, masked]);
}

describe("the WebSocket frames", () => {
  it("accepts the RFC's sample key", () => {
    expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  });

  it("encodes a frame of each length class", () => {
    expect([...encodeFrame(OP.text, "hi")]).toEqual([0x81, 2, 104, 105]);
    expect(encodeFrame(OP.binary, Buffer.alloc(300)).subarray(0, 4)).toEqual(Buffer.from([0x82, 126, 1, 44]));
    const long = encodeFrame(OP.binary, Buffer.alloc(70_000));
    expect([long[1], long.readBigUInt64BE(2)]).toEqual([127, 70_000n]);
  });

  it("decodes masked frames, keeping an incomplete one for the next read", () => {
    const text = clientFrame(OP.text, Buffer.from("hello"));
    const ping = clientFrame(OP.ping, Buffer.from("p"));
    const both = Buffer.concat([text, ping, ping.subarray(0, 3)]);
    const { frames, rest } = decodeFrames(both);
    expect(frames.map(({ opcode, payload, fin }) => [opcode, payload.toString(), fin])).toEqual([[OP.text, "hello", true], [OP.ping, "p", true]]);
    expect(rest).toEqual(ping.subarray(0, 3));
    expect(decodeFrames(clientFrame(OP.text, Buffer.alloc(300, 97))).frames[0]!.payload.length).toBe(300);
  });

  it("refuses an unmasked frame, reserved bits, and a message over the limit", () => {
    const refused = (buffer: Buffer, longest?: number) => { try { decodeFrames(buffer, longest); } catch (e) { return (e as ProtocolError).code; } };
    expect(refused(encodeFrame(OP.text, "hi"))).toBe(1002);
    const reserved = clientFrame(OP.text, Buffer.from("x")); reserved[0]! |= 0x40;
    expect(refused(reserved)).toBe(1002);
    expect(refused(clientFrame(OP.text, Buffer.alloc(200)), 100)).toBe(1009);
    expect(refused(clientFrame(OP.binary, Buffer.alloc(70_000)), 65_536)).toBe(1009);
  });
});

describe("the locks", () => {
  const lock = { port: 4777, key: "k3y" };
  const ok = { method: "GET", url: "/", host: "127.0.0.1:4777", cookie: `${cookieName(4777)}=k3y` };

  it("lets the studio's own page in, at either name of this computer", () => {
    expect(check(ok, lock)).toEqual({ allow: true });
    expect(check({ ...ok, host: "localhost:4777", origin: "http://localhost:4777" }, lock)).toEqual({ allow: true });
  });

  it("refuses another host, another port, and a missing host: a rebound name reaches no data", () => {
    for (const host of ["evil.example:4777", "127.0.0.1:4778", "127.0.0.1", undefined]) {
      expect(check({ ...ok, host }, lock)).toMatchObject({ allow: false, status: 421 });
    }
  });

  it("refuses a request from another site, even with the cookie", () => {
    for (const origin of ["https://evil.example", "http://127.0.0.1:4778", "null", "https://127.0.0.1:4777"]) {
      expect(check({ ...ok, origin }, lock)).toMatchObject({ allow: false, status: 403 });
    }
  });

  it("refuses a request without the cookie, or with another studio's", () => {
    for (const cookie of [undefined, "", `${cookieName(4777)}=nope`, `${cookieName(4778)}=k3y`, `x${cookieName(4777)}=k3y`]) {
      expect(check({ ...ok, cookie }, lock)).toMatchObject({ allow: false, status: 403 });
    }
  });

  it("trades the key in the URL for the cookie, and sends the browser to the same page without it", () => {
    expect(check({ ...ok, cookie: undefined, url: "/run/saved-views?key=k3y&x=1" }, lock)).toEqual({ allow: false, status: 303,
      location: "/run/saved-views?x=1", setCookie: `${cookieName(4777)}=k3y; Path=/; HttpOnly; SameSite=Strict` });
    expect(check({ ...ok, cookie: undefined, url: "/?key=wrong" }, lock)).toMatchObject({ allow: false, status: 403 });
  });
});

describe("the server", () => {
  let dir: string;
  let studio: Studio;
  const key = "the-key";
  const started: string[] = [];
  const get = (path: string, headers: Record<string, string> = {}) => new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((done, fail) => {
    request({ host: "127.0.0.1", port: studio.port, path, headers: { host: `127.0.0.1:${studio.port}`, cookie: `${cookieName(studio.port)}=${key}`, ...headers } }, (response) => {
      let body = "";
      response.setEncoding("utf8").on("data", (chunk: string) => { body += chunk; }).on("end", () => done({ status: response.statusCode!, headers: response.headers, body }));
    }).on("error", fail).end();
  });
  const send = (method: string, path: string, body: string, headers: Record<string, string> = {}) => new Promise<{ status: number; body: string }>((done, fail) => {
    request({ host: "127.0.0.1", port: studio.port, path, method, headers: { host: `127.0.0.1:${studio.port}`, cookie: `${cookieName(studio.port)}=${key}`,
      origin: `http://127.0.0.1:${studio.port}`, "content-type": "application/json", ...headers } }, (response) => {
      let text = "";
      response.setEncoding("utf8").on("data", (chunk: string) => { text += chunk; }).on("end", () => done({ status: response.statusCode!, body: text }));
    }).on("error", fail).end(body);
  });
  /** Opens a WebSocket by hand and returns the server's answer line and first frame, or the refusal. */
  const upgrade = (headers: Record<string, string> = {}) => new Promise<{ status: number; first?: string }>((done, fail) => {
    const asked = request({ host: "127.0.0.1", port: studio.port, path: "/ws", headers: { host: `127.0.0.1:${studio.port}`,
      cookie: `${cookieName(studio.port)}=${key}`, connection: "Upgrade", upgrade: "websocket", "sec-websocket-version": "13",
      "sec-websocket-key": randomBytes(16).toString("base64"), ...headers } });
    asked.on("upgrade", (response, socket, head: Buffer) => {
      // A server's frame is unmasked; the hello is short enough for a one-byte length.
      const read = (data: Buffer) => {
        socket.end(clientFrame(OP.close, Buffer.alloc(0)));
        done({ status: response.statusCode!, first: data.subarray(2, 2 + data[1]!).toString() });
      };
      if (head.length) read(head); else socket.once("data", read);
    });
    asked.on("response", (response) => { response.resume(); done({ status: response.statusCode! }); });
    asked.on("error", fail).end();
  });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "flow-reel-studio-"));
    mkdirSync(join(dir, "web/assets"), { recursive: true });
    writeFileSync(join(dir, "web/index.html"), "<p>shell</p>");
    writeFileSync(join(dir, "web/assets/app.js"), "console.log(1)");
    writeFileSync(join(dir, "secret.txt"), "secret");
    studio = await startStudio({ port: 0, key, web: join(dir, "web"), data: join(dir, "data"), version: "9.9.9",
      start: async (_data, file) => {
        if (file.endsWith("keyless.reel.ts")) throw new Error("voice openai needs OPENAI_API_KEY: set it in the environment and compose again");
        started.push(file);
        return { id: "my-shop/1" };
      } });
  });
  afterAll(async () => {
    await studio.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("listens on this computer only, and gives the address with its key", () => {
    expect(studio.url).toBe(`http://127.0.0.1:${studio.port}/?key=${key}`);
  });

  it("serves the web app's files, and its shell for a screen's path", async () => {
    expect(await get("/assets/app.js")).toMatchObject({ status: 200, body: "console.log(1)", headers: { "content-type": "text/javascript; charset=utf-8" } });
    for (const path of ["/", "/run", "/run/saved-views/7"]) expect(await get(path)).toMatchObject({ status: 200, body: "<p>shell</p>" });
    expect((await get("/")).headers["content-security-policy"]).toContain("default-src 'self'");
  });

  it("serves nothing outside the web app", async () => {
    for (const path of ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/%2e%2e/%2e%2e/secret.txt", "/missing.js", "/%zz"]) {
      expect([path, (await get(path)).status]).toEqual([path, 404]);
    }
  });

  it("answers the API, and refuses what the locks refuse", async () => {
    expect(JSON.parse((await get("/api/hello")).body)).toEqual({ v: 1, version: "9.9.9" });
    expect((await get("/api/hello", { cookie: "" })).status).toBe(403);
    expect((await get("/api/hello", { origin: "https://evil.example" })).status).toBe(403);
    expect((await get("/api/hello", { host: "evil.example" })).status).toBe(421);
    const traded = await get(`/scripts?key=${key}`, { cookie: "" });
    expect(traded).toMatchObject({ status: 303, headers: { location: "/scripts" } });
    expect(traded.headers["set-cookie"]).toEqual([`${cookieName(studio.port)}=${key}; Path=/; HttpOnly; SameSite=Strict`]);
  });

  it("takes a change only as JSON, from its own page, and not too long", async () => {
    const project = join(dir, "project");
    mkdirSync(project, { recursive: true });
    const asked = JSON.stringify({ path: project });
    expect((await send("POST", "/api/workspaces", asked, { origin: "" })).status).toBe(403);
    expect((await send("POST", "/api/workspaces", asked, { origin: "https://evil.example" })).status).toBe(403);
    expect((await send("POST", "/api/workspaces", asked, { cookie: "" })).status).toBe(403);
    expect((await send("POST", "/api/workspaces", `path=${project}`, { "content-type": "application/x-www-form-urlencoded" })).status).toBe(415);
    expect((await send("POST", "/api/workspaces", JSON.stringify({ path: "x".repeat(70_000) }))).status).toBe(413);
    expect((await send("POST", "/api/workspaces", "{")).status).toBe(400);
    expect(existsSync(join(project, "flow-reel.json"))).toBe(false);
    expect(JSON.parse((await send("POST", "/api/workspaces", asked)).body)).toEqual({ needs: "init", root: project, title: "project", scripts: "reels" });
    const made = JSON.parse((await send("POST", "/api/workspaces", JSON.stringify({ path: project, init: { title: "My shop" } }))).body);
    expect(made).toMatchObject({ added: { slug: "my-shop", title: "My shop" } });
    expect(JSON.parse((await get("/api/workspaces")).body)).toMatchObject([{ slug: "my-shop", root: project, missing: false, runs: 0, bytes: 0 }]);
    expect(JSON.parse((await get("/api/runs")).body)).toEqual([]);
    expect((await get("/api/clean")).status).toBe(400);
    expect((await get("/api/clean?workspace=nope")).status).toBe(404);
    expect(JSON.parse((await get(`/api/clean?workspace=${made.added.id}`)).body)).toEqual({ runs: 0, bytes: 0 });
    expect((await send("DELETE", "/api/workspaces", "")).status).toBe(404);
    expect((await send("POST", "/index.html", "{}")).status).toBe(405);
  });

  it("lists a workspace's scripts, shows one, runs it, and switches Run again on save", async () => {
    const [{ id }] = JSON.parse((await get("/api/workspaces")).body) as { id: string }[];
    const script = join(dir, "project/reels/tour.reel.ts");
    writeFileSync(script, "x");
    expect(JSON.parse((await get(`/api/scripts?workspace=${id}`)).body)).toMatchObject({ workspace: { slug: "my-shop" },
      scripts: [{ name: "tour", path: "tour.reel.ts", runs: [], onSave: false }] });
    expect(JSON.parse((await get(`/api/script?workspace=${id}&name=tour`)).body)).toEqual({ name: "tour", path: "tour.reel.ts", lines: ["x"], changed: [], noReel: true });
    expect((await get(`/api/script?workspace=${id}&name=nope`)).status).toBe(404);
    expect(JSON.parse((await send("POST", "/api/scripts/open", JSON.stringify({ path: script }))).body)).toEqual({ workspace: id, slug: "my-shop", name: "tour" });
    expect(JSON.parse((await send("POST", "/api/runs", JSON.stringify({ workspace: id, name: "tour" }))).body)).toEqual({ id: "my-shop/1" });
    expect(started).toEqual([script]);
    writeFileSync(join(dir, "project/reels/keyless.reel.ts"), "x");
    const refused = await send("POST", "/api/runs", JSON.stringify({ workspace: id, name: "keyless" }));
    expect([refused.status, JSON.parse(refused.body).error]).toEqual([400, expect.stringContaining("needs OPENAI_API_KEY")]);
    expect(JSON.parse((await send("POST", "/api/on-save", JSON.stringify({ workspace: id, name: "tour", on: true }))).body)).toEqual({ on: true });
    expect(JSON.parse((await get(`/api/scripts?workspace=${id}`)).body)).toMatchObject({ scripts: [{ name: "keyless", onSave: false }, { name: "tour", onSave: true }] });
    expect((await send("POST", "/api/on-save", JSON.stringify({ workspace: id, name: "tour", on: "yes" }))).status).toBe(400);
    expect(JSON.parse((await send("POST", "/api/on-save", JSON.stringify({ workspace: id, name: "tour", on: false }))).body)).toEqual({ on: false });
  });

  it("opens a WebSocket that says hello, only with the cookie and from its own page", async () => {
    expect(await upgrade()).toEqual({ status: 101, first: JSON.stringify({ v: 1, type: "hello", version: "9.9.9" }) });
    expect(await upgrade({ origin: `http://127.0.0.1:${studio.port}` })).toMatchObject({ status: 101 });
    expect(await upgrade({ cookie: "" })).toEqual({ status: 403 });
    expect(await upgrade({ origin: "https://evil.example" })).toEqual({ status: 403 });
  });

  it("closes its open WebSockets when it stops", async () => {
    const other = await startStudio({ port: 0, key, web: join(dir, "web"), data: join(dir, "data"), version: "9.9.9" });
    const socket = new WebSocket(`ws://127.0.0.1:${other.port}/ws`, { headers: { cookie: `${cookieName(other.port)}=${key}` } } as never);
    await new Promise((done) => { socket.onmessage = done; });
    const closed = new Promise((done) => { socket.onclose = done; });
    await other.close();
    await closed;
  });

  it("talks with a browser's WebSocket client", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${studio.port}/ws`, { headers: { cookie: `${cookieName(studio.port)}=${key}` } } as never);
    const first = await new Promise<string>((done, fail) => {
      socket.onmessage = (event) => done(String(event.data));
      socket.onerror = () => fail(new Error("the WebSocket failed"));
    });
    expect(JSON.parse(first)).toMatchObject({ type: "hello" });
    const closed = new Promise<number>((done) => { socket.onclose = (event) => done(event.code); });
    socket.close(1000);
    expect(await closed).toBe(1000);
  });
});

describe.skipIf(process.platform === "win32")("flow-reel studio", () => {
  // The command serves the built web app; the unit tests run before `npm run build` in CI.
  beforeAll(() => {
    if (!existsSync("dist/web/index.html")) execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--logLevel", "warn"], { stdio: "inherit" });
  }, 60_000);

  it("prints its address, serves the shell, and stops on Ctrl+C with 0", async () => {
    const free = createServer();
    await new Promise<void>((done) => free.listen(0, "127.0.0.1", done));
    const port = (free.address() as AddressInfo).port;
    await new Promise((done) => free.close(done));
    const child: ChildProcess = spawn(process.execPath, ["src/cli.ts", "studio", "--port", String(port), "--no-open", "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    try {
      const line = await new Promise<string>((done, fail) => {
        let out = "";
        child.stdout!.setEncoding("utf8").on("data", (chunk: string) => { out += chunk; if (out.includes("\n")) done(out.split("\n")[0]!); });
        child.on("exit", (code) => fail(new Error(`it ended with ${code}`)));
      });
      const { url } = JSON.parse(line) as { url: string };
      expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${port}/\\?key=[\\w-]{32}$`));
      const response = await fetch(url, { redirect: "manual" });
      expect(response.status).toBe(303);
      child.kill("SIGINT");
      expect(await new Promise((done) => child.on("exit", done))).toBe(0);
    } finally { child.kill(); }
  });

  it("names a port that is in use, and ends with 1", async () => {
    const busy = createServer();
    await new Promise<void>((done) => busy.listen(0, "127.0.0.1", done));
    const port = (busy.address() as AddressInfo).port;
    try {
      const child = spawn(process.execPath, ["src/cli.ts", "studio", "--port", String(port), "--no-open"], { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
      expect(await new Promise((done) => child.on("exit", done))).toBe(1);
      expect(stderr).toBe(`flow-reel: port ${port} is in use: is the studio already open? \`--port\` picks another\n`);
    } finally { await new Promise((done) => busy.close(done)); }
  });

  it("refuses a port that isn't a port", () => {
    const child = spawn(process.execPath, ["src/cli.ts", "studio", "--port", "abc"]);
    return expect(new Promise((done) => child.on("exit", done))).resolves.toBe(2);
  });
});

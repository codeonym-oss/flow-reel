// Watching a run in the studio (GH-137): a run by its id, its socket of entries and state, cancel, resume and its log.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { listen } from "../../src/host/control.ts";
import { Screen } from "../../src/host/screen.ts";
import { rememberWorkspace } from "../../src/host/data.ts";
import { openJournal } from "../../src/host/journal.ts";
import { takeLock } from "../../src/host/lock.ts";
import { logFile } from "../../src/host/run-folder.ts";
import type { LiveRun, ServerMessage } from "../../src/studio/api.ts";
import { findRun, logTail } from "../../src/studio/live.ts";
import { cookieName } from "../../src/studio/locks.ts";
import { startStudio } from "../../src/studio/server.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";
import { folder, project, startRun } from "./runs.ts";

vi.setConfig({ testTimeout: 30_000 });

async function setUp() {
  const [data, root] = [folder(), project()];
  rememberWorkspace(data, findWorkspace(root));
  const run = await startRun(data, root);
  // A run is listed once its process has opened its journal.
  openJournal(run.dir).close();
  return { data, root, run };
}

const KEY = "the-key";

async function studioOn(data: string, resumed: string[] = []) {
  const web = folder();
  mkdirSync(join(web, "assets"));
  writeFileSync(join(web, "index.html"), "<!doctype html>");
  return startStudio({ port: 0, key: KEY, web, data, version: "9.9.9", resume: async ({ id }) => { resumed.push(id); } });
}

/** A run's socket, with every message it has sent. */
function watch(port: number, run: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?run=${encodeURIComponent(run)}`, { headers: { cookie: `${cookieName(port)}=${KEY}` } } as never);
  socket.binaryType = "arraybuffer";
  const messages: ServerMessage[] = [];
  const pictures: string[] = [];
  socket.onmessage = (event) => {
    if (typeof event.data === "string") messages.push(JSON.parse(event.data) as ServerMessage);
    else pictures.push(Buffer.from(event.data as ArrayBuffer).toString());
  };
  const runs = () => messages.flatMap((message) => message.type === "run" ? [message.run] : []);
  return { socket, messages, pictures, last: (): LiveRun | undefined => runs().at(-1) };
}

const call = async (port: number, path: string, body?: unknown) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: body ? "POST" : "GET",
    headers: { cookie: `${cookieName(port)}=${KEY}`, ...(body ? { "content-type": "application/json", origin: `http://127.0.0.1:${port}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};

describe("a run in the studio", () => {
  it("sends its live picture while it records, and asks for none otherwise", async () => {
    const { data, run } = await setUp();
    const lock = takeLock(join(run.dir, "owner.lock"))!;
    const screen = new Screen();
    const told: string[] = [];
    screen.attach((input) => told.push(input));
    const control = await listen(run.dir, () => {}, screen);
    const studio = await studioOn(data);
    try {
      const { socket, pictures, last } = watch(studio.port, "shop/1");
      await vi.waitFor(() => expect(last()).toMatchObject({ state: "queued" }));
      expect(told).toEqual([]);
      const journal = openJournal(run.dir);
      journal.append({ type: "phase-started", phase: "record" });
      await vi.waitFor(() => expect(told).toEqual(["watch"]));
      screen.picture(Buffer.from("the app").toString("base64"));
      await vi.waitFor(() => expect(pictures).toEqual(["the app"]));
      journal.append({ type: "phase-finished", phase: "record" });
      journal.close();
      await vi.waitFor(() => expect(told).toEqual(["watch", "unwatch"]));
      socket.close();
    } finally { await studio.close(); control.close(); lock.release(); }
  });

  it("is found by its id", async () => {
    const { data, run } = await setUp();
    expect(findRun(data, "shop/1").run.dir).toBe(run.dir);
    expect(() => findRun(data, "shop/9")).toThrow("there is no run shop/9");
    expect(() => findRun(data, "shop")).toThrow("isn't a run");
  });

  it("sends its entries and state as they come, and takes Cancel to its process", async () => {
    const { data, run } = await setUp();
    const lock = takeLock(join(run.dir, "owner.lock"))!;
    const commands: string[] = [];
    const control = await listen(run.dir, (command) => { commands.push(command); });
    const studio = await studioOn(data);
    try {
      const { socket, messages, last } = watch(studio.port, "shop/1");
      await vi.waitFor(() => expect(last()).toMatchObject({ id: "shop/1", script: "a", path: "a.reel.ts", state: "queued", voice: "qwen3-tts-0.6b", flowReel: "0.8.0" }));
      const journal = openJournal(run.dir);
      journal.append({ type: "phase-started", phase: "record" });
      journal.append({ type: "progress", phase: "record", what: { type: "step", index: 0, comment: "Open it." } });
      await vi.waitFor(() => expect(last()).toMatchObject({ state: "running", phase: "record", finished: [] }));
      expect(messages.flatMap((message) => message.type === "entries" ? message.entries.map(({ type }) => type) : []))
        .toEqual(["created", "phase-started", "progress"]);
      socket.send(JSON.stringify({ v: 1, type: "cancel" }));
      await vi.waitFor(() => expect(commands).toEqual(["cancel"]));
      journal.append({ type: "failed", phase: "record", message: "Save view isn't there" });
      journal.close();
      await vi.waitFor(() => expect(last()).toMatchObject({ state: "failed", phase: "record", why: "Save view isn't there", endedAt: expect.any(String) }));
      socket.close();
    } finally { control.close(); lock.release(); await studio.close(); }
  });

  it("says when a cancel can't reach the run's process", async () => {
    const { data } = await setUp();
    const studio = await studioOn(data);
    try {
      const { socket, messages } = watch(studio.port, "shop/1");
      await vi.waitFor(() => expect(messages.length).toBeGreaterThan(0));
      socket.send(JSON.stringify({ v: 1, type: "cancel" }));
      await vi.waitFor(() => expect(messages).toContainEqual(expect.objectContaining({ type: "problem", error: expect.stringContaining("shop/1 can't be cancelled") })));
      socket.close();
    } finally { await studio.close(); }
  });

  it("refuses a socket for a run that isn't there", async () => {
    const { data } = await setUp();
    const studio = await studioOn(data);
    try {
      const { socket } = watch(studio.port, "shop/9");
      await new Promise((done) => { socket.onerror = done; });
    } finally { await studio.close(); }
  });

  it("resumes only a run that ended", async () => {
    const { data, run } = await setUp();
    const resumed: string[] = [];
    const studio = await studioOn(data, resumed);
    try {
      const lock = takeLock(join(run.dir, "owner.lock"))!;
      expect(await call(studio.port, "/api/runs/resume", { run: "shop/1" })).toEqual({ status: 409, body: { error: "shop/1 is queued: only a run that ended can go on" } });
      lock.release();
      const journal = openJournal(run.dir);
      journal.append({ type: "stopped", reason: "its process ended" });
      journal.close();
      expect(await call(studio.port, "/api/runs/resume", { run: "shop/1" })).toEqual({ status: 200, body: { id: "shop/1" } });
      expect(resumed).toEqual(["shop/1"]);
    } finally { await studio.close(); }
  });

  it("answers the end of its log", async () => {
    const { data, run } = await setUp();
    expect(logTail(run.dir)).toEqual({ text: "", cut: 0 });
    writeFileSync(logFile(run.dir), "one\ntwo\nthree\n");
    expect(logTail(run.dir, 9)).toEqual({ text: "three\n", cut: 8 });
    const studio = await studioOn(data);
    try { expect(await call(studio.port, "/api/log?run=shop/1")).toEqual({ status: 200, body: { text: "one\ntwo\nthree\n", cut: 0 } }); }
    finally { await studio.close(); }
  });

  it("answers its score and step pictures once recorded, and nothing before (GH-139)", async () => {
    const { data, run } = await setUp();
    const studio = await studioOn(data);
    try {
      expect((await call(studio.port, "/api/score?run=shop/1")).status).toBe(404);
      const record = join(run.dir, "record");
      mkdirSync(join(record, "steps"), { recursive: true });
      writeFileSync(join(record, "cues.json"), JSON.stringify({ version: 1, fps: 30, capture: { file: "capture.mp4", frames: 300, cutMs: 1000 },
        steps: [{ index: 0, comment: "Look.", startMs: 500, actionEndMs: 900, endMs: 4000 }, { index: 1, startMs: 4100, actionEndMs: 4200, endMs: 6000 }],
        events: [{ t: 600.4, type: "click", at: [1, 1], button: "left", target: "x" }, { t: 900, type: "sound", name: "toggle" },
          { t: 1200, type: "zoom", zoom: "in", at: [1, 1], scale: 1.3, ms: 650 }, { t: 5000, type: "card", card: "outro" }] }));
      writeFileSync(join(record, "steps", "000.jpg"), "jpeg");
      expect((await call(studio.port, "/api/score?run=shop/1")).body).toEqual({ durationMs: 9000,
        steps: [{ index: 0, comment: "Look.", startMs: 500, endMs: 4000, picture: true }, { index: 1, startMs: 4100, endMs: 6000, picture: false }],
        marks: [{ lane: "sounds", t: 900, label: "toggle" }, { lane: "effects", t: 1200, ms: 650, label: "zoom in" }, { lane: "cards", t: 5000, label: "outro" }] });
      const picture = (step: string) => fetch(`http://127.0.0.1:${studio.port}/api/step-picture?run=shop/1&step=${step}`, { headers: { cookie: `${cookieName(studio.port)}=${KEY}` } });
      const found = await picture("0");
      expect([found.status, found.headers.get("content-type"), await found.text()]).toEqual([200, "image/jpeg", "jpeg"]);
      expect((await picture("1")).status).toBe(404);
      expect((await picture("../x")).status).toBe(404);
    } finally { await studio.close(); }
  });
});

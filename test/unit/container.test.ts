import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { PhaseProgress } from "../../src/composer/progress.ts";
import { type ContainerMessage, type ContainerRequest, messageReader } from "../../src/container/protocol.ts";
import { type PhaseContainer, containerArgs, runContainer } from "../../src/host/container.ts";
import { resolveSettings } from "../../src/settings.ts";

const dir = mkdtempSync(join(tmpdir(), "flow-reel-container-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const record: ContainerRequest = { phase: "record", script: "admin/refund.reel.ts", brand: {}, integration: "playwright" };
const phase = (request: ContainerRequest = record, engine: Partial<PhaseContainer["engine"]> = {}): PhaseContainer => ({
  engine: { command: "docker", kind: "docker", desktop: false, ...engine }, image: "image", name: "flow-reel-1", runDir: "/data/1",
  out: "/data/1/out.tmp", request, credentials: ["OPENAI_API_KEY"], uid: 1000, gid: 1000 });
const local: ContainerRequest = { phase: "voice", voice: resolveSettings(undefined).voice };
const cloud: ContainerRequest = { phase: "voice", voice: resolveSettings({ voice: { adapter: "openai" } }).voice };

describe("containerArgs", () => {
  it("Linux Docker: the host's network and uid, and only what the phase reads", () => {
    expect(containerArgs(phase())).toEqual(["run", "--rm", "--init", "--interactive", "--shm-size=1g", "--name", "flow-reel-1",
      "-v", `${join("/data/1", "scripts")}:/scripts:ro`, "-v", "/data/1/out.tmp:/out", "--user", "1000:1000", "--network", "host", "image", JSON.stringify(record)]);
  });

  it("mounts the project nowhere, and the scripts only where they are used", () => {
    const mounts = (request: ContainerRequest) => containerArgs(phase(request)).filter((arg) => /:\//.test(arg) && !arg.startsWith("{"))
      .map((arg) => arg.slice(arg.indexOf(":") + 1));
    expect(mounts(record)).toEqual(["/scripts:ro", "/out"]);
    expect(mounts(local)).toEqual(["/record:ro", "/previous:ro", "/out"]);
    expect(mounts({ phase: "render", brand: {} })).toEqual(["/scripts:ro", "/record:ro", "/voice:ro", "/plan:ro", "/out"]);
  });

  it("gives the voice's container, and no other, the key, by name only (GH-33 decision 004)", () => {
    for (const request of [record, { phase: "render", brand: {} } as const]) expect(containerArgs(phase(request))).not.toContain("OPENAI_API_KEY");
    const args = containerArgs(phase(cloud));
    expect(args.slice(args.indexOf("-e"), args.indexOf("-e") + 2)).toEqual(["-e", "OPENAI_API_KEY"]);
    expect(args.indexOf("-e")).toBeLessThan(args.indexOf("image"));
  });

  it("gives the network to the phases that need it", () => {
    const network = (request: ContainerRequest) => { const args = containerArgs(phase(request)); return args[args.indexOf("--network") + 1]; };
    expect([record, cloud, local, { phase: "render", brand: {} } as const].map(network)).toEqual(["host", "host", "none", "none"]);
  });

  it("Docker Desktop: no host network; Chromium maps localhost to the host instead", () => {
    const args = containerArgs(phase(record, { desktop: true }));
    expect(args).not.toContain("--network");
    expect(args).toEqual(expect.arrayContaining(["-e", "FLOW_REEL_HOST_MAP=1"]));
    expect(containerArgs(phase({ phase: "render", brand: {} }, { desktop: true }))).toEqual(expect.arrayContaining(["--network", "none"]));
  });

  it("Podman: keeps the host's uid through the user namespace instead of --user", () => {
    const args = containerArgs(phase(record, { kind: "podman" }));
    expect(args).toContain("--userns=keep-id");
    expect(args).not.toContain("--user");
  });
});

it("reads messages in whatever pieces they arrive, and tells other lines apart", () => {
  const messages: ContainerMessage[] = [];
  const stray: string[] = [];
  const reader = messageReader((m) => messages.push(m), (line) => stray.push(line));
  for (const piece of ['{"type":"step","in', 'dex":0}\n\nhello\n{"a":1}\n', "[1]\nnull\n", '{"type":"failed","message":"no"}']) reader.push(piece);
  reader.end();
  expect(messages).toEqual([{ type: "step", index: 0 }, { type: "failed", message: "no" }]);
  expect(stray).toEqual(["hello", '{"a":1}', "[1]", "null"]);
});

// A fake engine on PATH, as a shell script: POSIX only.
describe.skipIf(process.platform === "win32")("runContainer", () => {
  const path = process.env.PATH;
  afterEach(() => { process.env.PATH = path; });
  const fake = (body: string) => {
    const bin = mkdtempSync(join(dir, "bin-"));
    writeFileSync(join(bin, "docker"), `#!/bin/sh\necho "$@" >> '${join(bin, "calls")}'\n[ "$1" = run ] || exit 0\n${body}\n`);
    chmodSync(join(bin, "docker"), 0o755);
    process.env.PATH = `${bin}:${path}`;
    return join(bin, "calls");
  };
  const run = async (signal?: AbortSignal) => {
    const reports: PhaseProgress[] = [];
    const lines: string[] = [];
    await runContainer(phase(), { report: (p) => reports.push(p), log: (line) => lines.push(line), ...(signal ? { signal } : {}) });
    return { reports, lines };
  };

  it("reports what the phase does and logs the rest", async () => {
    fake(`echo '{"type":"step","index":0}'; echo plain; echo '{"type":"step"}' >&2; echo '{"type":"step","index":1}'`);
    const { reports, lines } = await run();
    expect(reports).toEqual([{ type: "step", index: 0 }, { type: "step", index: 1 }]);
    expect(lines.sort()).toEqual(["plain", '{"type":"step"}']);
  });

  it("fails with what the phase said went wrong, or with what the container last printed", async () => {
    fake(`echo stack >&2; echo '{"type":"failed","message":"step 2 failed: no button"}'; exit 1`);
    await expect(run()).rejects.toThrow(/^step 2 failed: no button$/);
    fake("echo 'no space left on device' >&2; exit 125");
    await expect(run()).rejects.toThrow("the record container ended unexpectedly (exit 125):\nno space left on device");
  });

  it("ends the container by closing its input", async () => {
    const calls = fake("cat > /dev/null");
    const stop = new AbortController();
    const running = run(stop.signal);
    setTimeout(() => stop.abort(new Error("cancelled")), 300);
    await expect(running).rejects.toThrow("cancelled");
    expect(readFileSync(calls, "utf8")).toMatch(/^run /);
    await expect(run(stop.signal)).rejects.toThrow("cancelled");
  });

  it("removes a container that doesn't end", async () => {
    const calls = fake(`sleep 7`);
    const stop = new AbortController();
    const running = run(stop.signal);
    setTimeout(() => stop.abort(new Error("cancelled")), 200);
    await expect(running).rejects.toThrow("cancelled");
    expect(readFileSync(calls, "utf8")).toContain("rm --force flow-reel-1");
  }, 15_000);
});

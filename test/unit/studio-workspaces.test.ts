// What the studio's Workspaces screen reads and changes (GH-135), against a data folder made here.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { rememberWorkspace } from "../../src/host/data.ts";
import { openJournal } from "../../src/host/journal.ts";
import type { Run } from "../../src/host/run-folder.ts";
import type { RunEvent } from "../../src/run/machine.ts";
import { addWorkspace, clean, cleanPreview, runs, today, workspaces } from "../../src/studio/workspaces.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";
import { CONFIG, doPhase, folder, project, startRun } from "./runs.ts";

vi.setConfig({ testTimeout: 30_000 });

const T0 = Date.parse("2026-11-26T09:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

/** A run whose journal holds these events, a minute apart after its creation at `start`, and whose finished phases have their files. */
async function run(data: string, root: string, start: number, events: RunEvent[]): Promise<Run> {
  const made = await startRun(data, root);
  let minute = start;
  const journal = openJournal(made.dir, () => at(minute++));
  for (const event of events) {
    if (event.type === "phase-finished") await doPhase(made, event.phase);
    journal.append(event);
  }
  journal.close();
  return made;
}

const done: RunEvent[] = [{ type: "phase-started", phase: "record" }, { type: "phase-finished", phase: "record" },
  { type: "phase-started", phase: "voice" }, { type: "phase-finished", phase: "voice" },
  { type: "phase-started", phase: "plan" }, { type: "phase-finished", phase: "plan" },
  { type: "phase-started", phase: "render" }, { type: "phase-finished", phase: "render" },
  { type: "phase-started", phase: "publish" }, { type: "phase-finished", phase: "publish" }, { type: "done", reel: "reels/out/a.reel" }];
const failedInRender: RunEvent[] = [...done.slice(0, 6), { type: "phase-started", phase: "render" }, { type: "failed", phase: "render", message: "broken" }];

function setUp() {
  const [data, root] = [folder(), project()];
  rememberWorkspace(data, findWorkspace(root));
  return { data, root };
}

describe("the Workspaces screen's data", () => {
  it("lists every run, newest first, with what can be done with it", async () => {
    const { data, root } = setUp();
    await run(data, root, 0, done);
    await run(data, root, 20, failedInRender);
    expect(await runs(data)).toEqual([
      { id: "shop/2", workspace: CONFIG.workspace.id, script: "a", startedAt: expect.any(String), endedAt: at(28).toISOString(),
        state: "failed", phase: "render", finished: 3, why: "broken", resume: "render", files: true },
      { id: "shop/1", workspace: CONFIG.workspace.id, script: "a", startedAt: expect.any(String), endedAt: at(11).toISOString(),
        state: "done", finished: 5, files: true },
    ]);
  });

  it("describes each workspace: its folder, scripts, runs, last runs and run files' size", async () => {
    const { data, root } = setUp();
    await run(data, root, 0, done);
    const [shop] = await workspaces(data);
    expect(shop).toMatchObject({ id: CONFIG.workspace.id, slug: "shop", title: "Shop", root, missing: false, scripts: 1, runs: 1,
      latest: { id: "shop/1", state: "done" }, last: [{ state: "done" }] });
    expect(shop!.bytes).toBeGreaterThan(0);
    rmSync(join(root, "flow-reel.json"));
    expect((await workspaces(data))[0]).toMatchObject({ missing: true, scripts: 0, runs: 1 });
  });

  it("draws today's turns at heavy work, and the waits for them; a cloud voice and planning aren't heavy", async () => {
    const { data, root } = setUp();
    await run(data, root, -24 * 60, done);
    await run(data, root, 60, [{ type: "waiting", phase: "record", behind: "other/1" }, ...failedInRender]);
    const turns = today(data, T0);
    const minute = (n: number) => at(n).toISOString();
    expect(turns).toEqual([
      { run: "shop/2", workspace: CONFIG.workspace.id, state: "failed", phase: "record", kind: "wait", from: minute(61), to: minute(62) },
      { run: "shop/2", workspace: CONFIG.workspace.id, state: "failed", phase: "record", kind: "turn", from: minute(62), to: minute(63) },
      { run: "shop/2", workspace: CONFIG.workspace.id, state: "failed", phase: "voice", kind: "turn", from: minute(64), to: minute(65) },
      { run: "shop/2", workspace: CONFIG.workspace.id, state: "failed", phase: "render", kind: "turn", from: minute(68), to: minute(69) },
    ]);
  });

  it("adds a workspace from its full path, or offers to make one, and refuses other paths", () => {
    const data = folder();
    const root = project();
    expect(addWorkspace(data, { path: root })).toEqual({ added: { id: CONFIG.workspace.id, slug: "shop", title: "Shop" } });
    const bare = folder();
    mkdirSync(join(bare, "reels"));
    expect(addWorkspace(data, { path: bare })).toMatchObject({ needs: "init", root: bare, scripts: "reels" });
    expect(existsSync(join(bare, "flow-reel.json"))).toBe(false);
    expect(() => addWorkspace(data, { path: bare, init: { title: "Shop" } })).toThrow(/already the name of Shop/);
    expect(addWorkspace(data, { path: bare, init: { title: "Admin" } })).toMatchObject({ added: { slug: "admin", title: "Admin" } });
    expect(JSON.parse(readFileSync(join(bare, "flow-reel.json"), "utf8"))).toMatchObject({ workspace: { slug: "admin" } });
    for (const path of ["reels", "./x", join(bare, "missing")]) {
      expect(() => addWorkspace(data, { path })).toThrow(/full path|no folder/);
    }
    expect(() => addWorkspace(data, { path: "~/" + "flow-reel-surely-missing" })).toThrow(join(homedir(), "flow-reel-surely-missing"));
  });

  it("cleans what `flow-reel clean` would, and keeps what can go on", async () => {
    const { data, root } = setUp();
    await run(data, root, 0, done);
    const resumable = await run(data, root, 20, failedInRender);
    const preview = await cleanPreview(data, CONFIG.workspace.id);
    expect(preview).toMatchObject({ runs: 1 });
    expect(await clean(data, CONFIG.workspace.id)).toEqual(preview);
    expect(existsSync(join(resumable.dir, "record"))).toBe(true);
    expect((await runs(data)).map(({ id, files }) => [id, files])).toEqual([["shop/2", true], ["shop/1", false]]);
    await expect(clean(data, "nope")).rejects.toThrow(/no workspace nope/);
  });
});

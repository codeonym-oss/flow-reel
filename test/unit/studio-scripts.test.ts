// What the studio's Scripts screen reads and does (GH-136), against workspaces and runs made here.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { rememberWorkspace } from "../../src/host/data.ts";
import { sha256Text } from "../../src/host/files.ts";
import { openJournal } from "../../src/host/journal.ts";
import { OnSave } from "../../src/studio/on-save.ts";
import { changedLines, openScript, scripts, source } from "../../src/studio/scripts.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";
import { CONFIG, folder, project, startRun } from "./runs.ts";

vi.setConfig({ testTimeout: 30_000 });

const ID = CONFIG.workspace.id;
const off = { isOn: () => false, failure: () => undefined };

/** A reel of `reels/a.reel.ts` in the output folder, made from a script whose text was `text`. */
function reel(root: string, text: string) {
  const dir = join(root, "reels/out/a.reel");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "transcript.json"), JSON.stringify({ version: 2, video: { durationMs: 40_000 },
    steps: [{ comment: "Open it." }, { comment: " " }, {}] }));
  writeFileSync(join(dir, "events.json"), JSON.stringify({ version: 6, events: [{ type: "sound" }, { type: "click" }, { type: "zoom" },
    { type: "zoom" }, { type: "overlay" }, { type: "card" }] }));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, script: { file: "a.reel.ts", sha256: sha256Text(text) } }));
}

async function setUp(text = "a") {
  const [data, root] = [folder(), project()];
  writeFileSync(join(root, "reels/a.reel.ts"), text);
  rememberWorkspace(data, findWorkspace(root));
  return { data, root };
}

describe("the Scripts screen's data", () => {
  it("counts what each script's last reel holds", async () => {
    const { data, root } = await setUp();
    writeFileSync(join(root, "reels/b.reel.ts"), "b");
    reel(root, "a");
    const { workspace, scripts: list } = await scripts(data, ID, off);
    expect(workspace).toEqual({ id: ID, slug: "shop", title: "Shop", root, scripts: "reels" });
    expect(list).toEqual([
      { name: "a", path: "a.reel.ts", reel: { steps: 3, comments: 1, sounds: 1, effects: 3, cards: 1, ms: 40_000, at: expect.any(String) }, runs: [], onSave: false },
      { name: "b", path: "b.reel.ts", runs: [], onSave: false },
    ]);
  });

  it("marks the lines changed since the last reel, against the copy its run kept", async () => {
    const { data, root } = await setUp("one\ntwo\nthree");
    expect(source(data, ID, "a")).toEqual({ name: "a", path: "a.reel.ts", lines: ["one", "two", "three"], changed: [], noReel: true });
    const run = await startRun(data, root);
    const journal = openJournal(run.dir);
    for (const phase of ["record", "voice", "plan", "render", "publish"] as const) {
      journal.append({ type: "phase-started", phase });
      journal.append({ type: "phase-finished", phase });
    }
    journal.append({ type: "done", reel: "reels/out/a.reel" });
    journal.close();
    reel(root, "one\ntwo\nthree");
    expect(source(data, ID, "a").changed).toEqual([]);
    writeFileSync(join(root, "reels/a.reel.ts"), "one\n2\nthree\nfour");
    expect(source(data, ID, "a").changed).toEqual([2, 4]);
    rmSync(join(run.dir, "scripts"), { recursive: true });
    expect(source(data, ID, "a").changed).toBe("unknown");
  });

  it("finds the lines that aren't in the text before", () => {
    expect(changedLines(["a", "b", "c"], ["a", "c"])).toEqual([]);
    expect(changedLines(["a", "b", "c"], ["x", "a", "b", "y", "c"])).toEqual([1, 4]);
    expect(changedLines([], ["a"])).toEqual([1]);
  });

  it("opens a script by its full path, and remembers its workspace", async () => {
    const data = folder();
    const root = project();
    expect(openScript(data, join(root, "reels/a.reel.ts"))).toEqual({ workspace: ID, slug: "shop", name: "a" });
    writeFileSync(join(root, "notes.reel.ts"), "");
    for (const path of ["reels/a.reel.ts", join(root, "notes.reel.ts"), join(root, "reels/missing.reel.ts")]) {
      expect(() => openScript(data, path)).toThrow(/full path|outside the scripts folder|doesn't exist/);
    }
  });
});

describe("run again on save", () => {
  it("starts a run per save that changes the script, and one after a run that is going for the saves meanwhile", async () => {
    const root = project();
    const file = join(root, "reels/a.reel.ts");
    let going = false;
    const started: string[] = [];
    const onSave = new OnSave({ start: async (path) => { started.push(path); }, going: () => going });
    try {
      onSave.set(file, true);
      expect(onSave.isOn(file)).toBe(true);
      writeFileSync(file, "a");
      await sleep(700);
      expect(started).toEqual([]);
      writeFileSync(file, "b");
      await vi.waitFor(() => expect(started).toEqual([file]));
      going = true;
      for (const text of ["c", "d", "e"]) { writeFileSync(file, text); await sleep(400); }
      await sleep(1200);
      expect(started).toHaveLength(1);
      going = false;
      await vi.waitFor(() => expect(started).toHaveLength(2), { timeout: 3000 });
      onSave.set(file, false);
      writeFileSync(file, "f");
      await sleep(800);
      expect(started).toHaveLength(2);
    } finally { onSave.close(); }
  });

  it("keeps why a run couldn't start", async () => {
    const root = project();
    const file = join(root, "reels/a.reel.ts");
    const onSave = new OnSave({ start: async () => { throw new Error("voice openai needs OPENAI_API_KEY"); }, going: () => false });
    try {
      onSave.set(file, true);
      writeFileSync(file, "z");
      await vi.waitFor(() => expect(onSave.failure(file)).toBe("voice openai needs OPENAI_API_KEY"));
    } finally { onSave.close(); }
  });
});

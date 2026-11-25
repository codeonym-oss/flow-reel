import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeResult, resultProblem } from "../../src/host/results.ts";
import { type Run, createRun, readRun, runsDir, scriptsHash } from "../../src/host/run-folder.ts";
import { resolveSettings } from "../../src/settings.ts";
import type { Config } from "../../src/workspace/config.ts";
import { findScript, findWorkspace, reelFolder } from "../../src/workspace/workspace.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const folder = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "flow-reel-run-")));
  dirs.push(dir);
  return dir;
};
const config: Config = { version: 2, workspace: { id: "abcdefghijkl", slug: "shop", title: "Shop" }, scripts: "reels", output: "reels/out",
  brand: { theme: "ocean" } };
function project(files: Record<string, string>): string {
  const root = folder();
  writeFileSync(join(root, "flow-reel.json"), JSON.stringify(config));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}
const start = (data: string, root: string, script = "reels/a.reel.ts"): Promise<Run> => {
  const found = findScript(join(root, script));
  return createRun(data, { ...found, settings: resolveSettings(undefined), sound: true, reel: reelFolder(found.workspace, found.script),
    credentials: [], flowReel: "0.8.0" });
};

describe("a run's folder", () => {
  it("holds what was asked, a copy of the scripts folder, and the clips of the reel it replaces", async () => {
    const data = folder();
    const root = project({ "reels/a.reel.ts": "a", "reels/helpers/login.ts": "h", "reels/brand/logo.svg": "l", ".env": "SECRET",
      "reels/.env": "SECRET", "reels/node_modules/p/index.js": "p", "reels/old.reel/video.mp4": "v",
      "reels/out/a.reel/transcript.json": "{}", "reels/out/a.reel/audio/000.wav": "clip", "reels/out/a.reel/video.mp4": "v" });
    const run = await start(data, root);
    expect(run.number).toBe(1);
    expect(run.dir).toBe(join(runsDir(data, "abcdefghijkl"), "1"));
    const files = readdirSync(run.dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name).slice(run.dir.length + 1).replaceAll("\\", "/")).sort();
    expect(files).toEqual(["previous/audio/000.wav", "previous/transcript.json", "request.json", "scripts/a.reel.ts",
      "scripts/brand/logo.svg", "scripts/helpers/login.ts"]);
    expect(run.request).toMatchObject({ version: 1, flowReel: "0.8.0", workspace: { id: "abcdefghijkl", title: "Shop", root },
      script: { name: "a", path: "a.reel.ts" }, brand: { theme: "ocean" }, sound: true, reel: join(root, "reels/out/a.reel"), credentials: [] });
    expect(readRun(data, "abcdefghijkl", 1)).toEqual(run);
    expect(readRun(data, "abcdefghijkl", 2)).toBeUndefined();
  });

  it("works on one version of the scripts, and can tell when they have changed since", async () => {
    const root = project({ "reels/a.reel.ts": "a", "reels/helper.ts": "h" });
    const run = await start(folder(), root);
    expect(await scriptsHash(findWorkspace(root))).toBe(run.request.script.folder);
    mkdirSync(join(root, "reels/out/a.reel"), { recursive: true });
    writeFileSync(join(root, "reels/out/a.reel/video.mp4"), "v"); // a reel isn't a script
    expect(await scriptsHash(findWorkspace(root))).toBe(run.request.script.folder);
    writeFileSync(join(root, "reels/helper.ts"), "changed");
    expect(await scriptsHash(findWorkspace(root))).not.toBe(run.request.script.folder);
    expect(readFileSync(join(run.dir, "scripts/helper.ts"), "utf8")).toBe("h");
  });

  it("numbers runs in the order they started, without gaps or doubles when several start at once", async () => {
    const data = folder();
    const root = project({ "reels/a.reel.ts": "a" });
    const runs = await Promise.all(Array.from({ length: 8 }, () => start(data, root)));
    expect(runs.map((run) => run.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(readdirSync(runsDir(data, "abcdefghijkl")).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("leaves nothing when it can't be made", async () => {
    const data = folder();
    const root = project({ "reels/a.reel.ts": "a" });
    const found = findScript(join(root, "reels/a.reel.ts"));
    unlinkSync(found.script.file);
    await expect(createRun(data, { ...found, settings: resolveSettings(undefined), sound: true, reel: "x", credentials: [], flowReel: "0.8.0" })).rejects.toThrow();
    expect(readdirSync(runsDir(data, "abcdefghijkl"))).toEqual([]);
  });
});

describe("a phase's result", () => {
  const made = async () => {
    const run = await start(folder(), project({ "reels/a.reel.ts": "a" }));
    await makeResult(run.dir, "record", async (dir) => { writeFileSync(join(dir, "cues.json"), "cues"); writeFileSync(join(dir, "capture.mp4"), "capture"); });
    await makeResult(run.dir, "voice", async (dir) => { mkdirSync(join(dir, "audio")); writeFileSync(join(dir, "audio/000.wav"), "clip"); });
    return run.dir;
  };

  it("holds while its inputs and its files are what it was made from", async () => {
    const run = await made();
    expect(await resultProblem(run, "record")).toBeUndefined();
    expect(await resultProblem(run, "voice")).toBeUndefined();
    expect(await resultProblem(run, "plan")).toBe("it has no result");
    writeFileSync(join(run, "voice/audio/000.wav"), "Clip");
    expect(await resultProblem(run, "voice")).toBe("audio/000.wav changed");
    rmSync(join(run, "voice/audio/000.wav"));
    expect(await resultProblem(run, "voice")).toBe("audio/000.wav is missing");
  });

  it("doesn't hold once an earlier result was made again, is gone, or the request changed", async () => {
    let run = await made();
    await makeResult(run, "record", async (dir) => { writeFileSync(join(dir, "cues.json"), "other cues"); });
    expect(await resultProblem(run, "voice")).toBe("it was made from another record");
    rmSync(join(run, "record"), { recursive: true });
    expect(await resultProblem(run, "voice")).toBe("it was made from a record that is gone");
    run = await made();
    writeFileSync(join(run, "request.json"), "{}");
    expect(await resultProblem(run, "record")).toBe("it was made from another request");
    writeFileSync(join(run, "record/result.json"), "{");
    expect(await resultProblem(run, "record")).toBe("its result can't be read");
  });

  it("is complete or isn't there", async () => {
    const run = await made();
    await expect(makeResult(run, "plan", async (dir) => { writeFileSync(join(dir, "plan.json"), "half"); throw new Error("stopped"); })).rejects.toThrow("stopped");
    expect(existsSync(join(run, "plan"))).toBe(false);
    await makeResult(run, "plan", async (dir) => { expect(readdirSync(dir)).toEqual([]); writeFileSync(join(dir, "plan.json"), "whole"); });
    expect(await resultProblem(run, "plan")).toBeUndefined();
  });
});

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Config, readConfig, validateConfig } from "../../src/workspace/config.ts";
import { findScript, findWorkspace, listScripts, reelFolder } from "../../src/workspace/workspace.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const config: Config = { version: 2, workspace: { id: "abcdefghijkl", slug: "shop", title: "Shop" }, scripts: "reels", output: "reels/out" };
/** A project with these files; a file's content is empty unless given. */
function project(files: string[], json: object | null = config): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "flow-reel-workspace-")));
  dirs.push(root);
  if (json) writeFileSync(join(root, "flow-reel.json"), JSON.stringify(json));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), "");
  }
  return root;
}

describe("flow-reel.json", () => {
  it("takes a workspace, its folders, and the settings it had before", () => {
    expect(validateConfig({ ...config, integration: "playwright", brand: { theme: "ink" },
      voice: { adapter: "a", speaker: "b", language: "c" } })).toEqual([]);
    expect(validateConfig([])).toEqual(["must be a JSON object"]);
    expect(validateConfig({ ...config, version: 3 })).toEqual(["version must be 2"]);
    expect(validateConfig({ ...config, env: ["KEY"] })).toEqual(['unknown key "env"; it takes version, workspace, scripts, output, integration, voice, brand, limits, keepRuns']);
    expect(validateConfig({ ...config, voice: { seed: 1 } })).toEqual(['voice: unknown key "seed"; it takes adapter, speaker, language, model, apiKeyEnv, baseUrl']);
    expect(validateConfig({ ...config, limits: { record: 90, render: 0.5 } })).toEqual([]);
    expect(validateConfig({ ...config, keepRuns: 1 })).toEqual([]);
    for (const keepRuns of [0, 1.5, "5"]) expect(validateConfig({ ...config, keepRuns })).toEqual(["keepRuns must be a whole number, at least 1"]);
    expect(validateConfig({ ...config, limits: { record: 0, voice: "5", render: 2000, plan: 1 } })).toEqual(['limits: unknown key "plan"; it takes record, voice, render',
      ...["record", "voice", "render"].map((phase) => `limits.${phase} must be a number of minutes, more than 0 and at most 1440`)]);
    expect(validateConfig({ ...config, integration: 1, voice: { speaker: 2 } })).toEqual(["integration must be a string", "voice.speaker must be a string"]);
    expect(validateConfig({ ...config, workspace: { id: "x", slug: "My Shop", title: " ", owner: "me" } })).toEqual([
      'workspace: unknown key "owner"; it takes id, slug, title, description',
      "workspace.id must be the 12 letters and digits `flow-reel init` wrote",
      "workspace.slug must be lowercase words joined by hyphens", "workspace.title must be text"]);
  });

  it("keeps both folders inside the workspace, and reels out of the way of scripts", () => {
    const folders = (scripts: unknown, output: unknown) => validateConfig({ ...config, scripts, output });
    expect(folders("reels", "demos")).toEqual([]);
    expect(folders("demos/reels", "demos/videos")).toEqual([]);
    expect(folders(".", "out")).toEqual(["scripts must be a folder inside the workspace, not ."]);
    expect(folders("../reels", "/out")).toEqual(["scripts must be a folder inside the workspace, not ../reels",
      "output must be relative to flow-reel.json, not absolute"]);
    expect(folders("reels\\a", "C:/out")).toEqual(["scripts must use forward slashes", "output must be relative to flow-reel.json, not absolute"]);
    expect(folders("reels", "./reels/")).toEqual(["output must not be the scripts folder or hold it; it can be inside it"]);
    expect(folders("demos/reels", "demos")).toEqual(["output must not be the scripts folder or hold it; it can be inside it"]);
    expect(folders("reels", "reels-out")).toEqual([]);
  });

  it("names the file and what is wrong when it can't be read", () => {
    const root = project([], null);
    expect(readConfig(root)).toBeUndefined();
    writeFileSync(join(root, "flow-reel.json"), "{ version: 2 }");
    expect(() => readConfig(root)).toThrow(join(root, "flow-reel.json") + ": ");
    writeFileSync(join(root, "flow-reel.json"), '{ "version": 1, "voice": { "adapter": "openai" } }');
    expect(readConfig(root)).toEqual({ kind: "legacy", config: { version: 1, voice: { adapter: "openai" } } });
    writeFileSync(join(root, "flow-reel.json"), '{ "version": 1, "voice": [] }');
    expect(() => readConfig(root)).toThrow("voice must be an object");
  });
});

describe("finding a script", () => {
  it("finds the workspace above it, names it by its path, and places its reel", () => {
    const root = project(["reels/admin/refund.reel.ts"]);
    const { workspace, script } = findScript(join(root, "reels/admin/refund.reel.ts"));
    expect(workspace).toEqual({ root, config, scriptsDir: join(root, "reels"), outputDir: join(root, "reels/out") });
    expect(script).toEqual({ name: "admin/refund", path: "admin/refund.reel.ts", file: join(root, "reels/admin/refund.reel.ts") });
    expect(reelFolder(workspace, script)).toBe(join(root, "reels/out/admin/refund.reel"));
    expect(reelFolder(workspace, script, join(root, "tmp"))).toBe(join(root, "tmp/admin/refund.reel"));
  });

  it("lists scripts by name, and no file of a reel, an output folder, packages or a hidden folder", () => {
    const root = project(["reels/b.reel.js", "reels/a/a.reel.ts", "reels/helpers.ts", "reels/out/x.reel.ts", "reels/node_modules/p/x.reel.ts",
      "reels/.cache/x.reel.ts", "reels/old.reel/x.reel.ts"]);
    expect(listScripts(findWorkspace(root)).map((s) => s.path)).toEqual(["a/a.reel.ts", "b.reel.js"]);
    expect(listScripts(findWorkspace(project([])))).toEqual([]);
  });

  it("says what to do without a workspace, with one from before 0.8, or with two", () => {
    expect(() => findScript(join(project([], null), "missing.reel.ts"))).toThrow("missing.reel.ts doesn't exist");
    expect(() => findScript(join(project(["reels/a.reel.ts"], null), "reels/a.reel.ts"))).toThrow("isn't in a workspace: run `flow-reel init`");
    expect(() => findScript(join(project(["reels/a.reel.ts"], { version: 1 }), "reels/a.reel.ts"))).toThrow("is from before flow-reel 0.8: run `flow-reel init`");
    const root = project(["reels/a.reel.ts"]);
    writeFileSync(join(root, "reels/flow-reel.json"), JSON.stringify(config));
    expect(() => findScript(join(root, "reels/a.reel.ts"))).toThrow("a workspace has one flow-reel.json");
    const other = project(["reels/a.reel.ts", "reels/sub/flow-reel.json"]);
    expect(() => findScript(join(other, "reels/a.reel.ts"))).toThrow(join(other, "reels/sub/flow-reel.json"));
  });

  it("refuses a script with another name, outside the scripts folder, or in a folder that holds none", () => {
    const root = project(["reels/a.ts", "src/a.reel.ts", "reels/out/a.reel.ts"]);
    expect(() => findScript(join(root, "reels/a.ts"))).toThrow("rename it to a.reel.ts");
    expect(() => findScript(join(root, "src/a.reel.ts"))).toThrow("is outside the scripts folder, reels in ");
    expect(() => findScript(join(root, "reels/out/a.reel.ts"))).toThrow("is in a folder that holds no scripts");
    expect(() => findScript(join(project(["src/a.reel.ts"]), "src/a.reel.ts"))).toThrow("is outside the scripts folder");
  });

  it("refuses two scripts that would give the same reel", () => {
    const root = project(["reels/a.reel.ts", "reels/a.reel.js"]);
    expect(() => findScript(join(root, "reels/a.reel.ts"))).toThrow("a.reel.ts and a.reel.js would give the same reel: rename one");
  });

  it.skipIf(process.platform === "win32")("finds a script through a link to the project, and refuses one that links outside", () => {
    const root = project(["reels/a.reel.ts"]);
    const link = `${root}-link`;
    symlinkSync(root, link);
    dirs.push(link);
    expect(findScript(join(link, "reels/a.reel.ts")).script.name).toBe("a");
    symlinkSync(join(project(["x.reel.ts"], null), "x.reel.ts"), join(root, "reels/linked.reel.ts"));
    expect(() => findScript(join(root, "reels/linked.reel.ts"))).toThrow("is outside the scripts folder");
  });
});

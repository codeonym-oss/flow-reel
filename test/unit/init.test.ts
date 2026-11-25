import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SlugTakenError, dataDir, knownWorkspaces, localSlug, rememberWorkspace } from "../../src/host/data.ts";
import type { Config } from "../../src/workspace/config.ts";
import { newId, slugify } from "../../src/workspace/init.ts";
import { findWorkspace } from "../../src/workspace/workspace.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function folder(files: Record<string, string> = {}): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "flow-reel-init-")));
  dirs.push(root);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}
const cli = resolve("src/cli.ts");
const run = (data: string, cwd: string, ...args: string[]) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", input: "", env: { ...process.env, FLOW_REEL_DATA_DIR: data } });
  return { status, stdout, stderr };
};
const config = (root: string): Config => JSON.parse(readFileSync(join(root, "flow-reel.json"), "utf8"));

it("finds each system's data folder", () => {
  expect(dataDir({ FLOW_REEL_DATA_DIR: "/data" }, "linux", "/home/me")).toBe("/data");
  expect(dataDir({}, "linux", "/home/me")).toBe(join("/home/me", ".local", "share", "flow-reel"));
  expect(dataDir({ XDG_DATA_HOME: "/xdg" }, "linux", "/home/me")).toBe(join("/xdg", "flow-reel"));
  expect(dataDir({ XDG_DATA_HOME: "relative" }, "linux", "/home/me")).toBe(join("/home/me", ".local", "share", "flow-reel"));
  expect(dataDir({}, "darwin", "/Users/me")).toBe(join("/Users/me", "Library", "Application Support", "flow-reel"));
  expect(dataDir({ LOCALAPPDATA: "L" }, "win32", "H")).toBe(join("L", "flow-reel"));
  expect(dataDir({}, "win32", "H")).toBe(join("H", "AppData", "Local", "flow-reel"));
});

it("makes a name from a title, and a new id each time", () => {
  expect(slugify("  Café & Shop, v2! ")).toBe("cafe-shop-v2");
  expect(slugify("商店")).toBe("");
  expect(newId()).toMatch(/^[a-z2-7]{12}$/);
  expect(newId()).not.toBe(newId());
});

describe("flow-reel init", () => {
  it("writes the workspace's file and its scripts folder", () => {
    const [data, root] = [folder(), folder()];
    const result = run(data, root, "init", "--title", "My Shop", "--description", "The shop");
    expect(result).toMatchObject({ status: 0, stderr: "" });
    expect(result.stdout).toContain("My Shop (my-shop) is a workspace now: flow-reel.json\n");
    expect(config(root)).toEqual({ version: 2, workspace: { id: expect.stringMatching(/^[a-z2-7]{12}$/), slug: "my-shop", title: "My Shop",
      description: "The shop" }, scripts: "reels", output: "reels/out" });
    expect(existsSync(join(root, "reels"))).toBe(true);
    expect(knownWorkspaces(data)).toMatchObject([{ slug: "my-shop", roots: [root] }]);
    expect(run(data, root, "init", "--title", "Again")).toMatchObject({ status: 1, stderr: `flow-reel: ${root} is already a workspace, "My Shop"\n` });
  });

  it("asks nothing without a terminal, and writes nothing when something is wrong", () => {
    const [data, root] = [folder(), folder()];
    expect(run(data, root, "init")).toMatchObject({ status: 2, stderr: expect.stringContaining("--title is needed") });
    expect(run(data, root, "init", "--title", "商店")).toMatchObject({ status: 1, stderr: expect.stringContaining("give one with --slug") });
    expect(run(data, root, "init", "--title", "Shop", "--scripts", "../x")).toMatchObject({ status: 1 });
    expect(run(data, root, "init", "--title", "Shop", "--slug", "My Shop")).toMatchObject({ status: 1, stderr: expect.stringContaining("--slug must be") });
    expect(existsSync(join(root, "flow-reel.json"))).toBe(false);
    expect(run(data, root, "init", "--title", "商店", "--slug", "shop")).toMatchObject({ status: 0 });
  });

  it("takes over a 0.7 file's voice and brand, moves their paths, and names the scripts to rename", () => {
    const [data, root] = [folder(), folder({
      "demos/flow-reel.json": JSON.stringify({ version: 1, integration: "playwright", voice: { adapter: "openai", apiKeyEnv: "KEY" },
        brand: { theme: "ocean", logo: "brand/logo.svg", fonts: { body: "brand/body.woff2" } } }),
      "demos/tour.ts": 'import { script } from "flow-reel";\nexport default script({ url: "x" }, async () => {});\n',
      "demos/helpers.ts": "export const a = 1;", "demos/tour.reel/video.mp4": "" })];
    const result = run(data, root, "init", "--title", "Orbit");
    expect(result).toMatchObject({ status: 0, stderr: "" });
    expect(config(root)).toMatchObject({ scripts: "demos", output: "demos/out", integration: "playwright",
      voice: { adapter: "openai", apiKeyEnv: "KEY" }, brand: { theme: "ocean", logo: "brand/logo.svg", fonts: { body: "brand/body.woff2" } } });
    expect(existsSync(join(root, "demos/flow-reel.json"))).toBe(false);
    expect(result.stdout).toContain("Took over the settings of demos/flow-reel.json");
    expect(result.stdout).toContain("  git mv demos/tour.ts demos/tour.reel.ts\n");
    expect(result.stdout).not.toContain("helpers.ts");
  });

  it("takes over a file at the root, once its brand's files are in the scripts folder", () => {
    const legacy = JSON.stringify({ version: 1, brand: { logo: "reels/logo.svg" } });
    const root = folder({ "flow-reel.json": legacy });
    expect(run(folder(), root, "init", "--title", "Shop")).toMatchObject({ status: 0 });
    expect(config(root).brand).toEqual({ logo: "logo.svg" });
    const outside = folder({ "flow-reel.json": legacy.replace("reels/", "public/") });
    expect(run(folder(), outside, "init", "--title", "Shop")).toMatchObject({ status: 1, stderr: expect.stringContaining("move it there first") });
    expect(readFileSync(join(outside, "flow-reel.json"), "utf8")).toBe(legacy.replace("reels/", "public/"));
  });

  it("refuses several files, and a workspace inside another", () => {
    const several = folder({ "a/flow-reel.json": '{"version":1}', "b/flow-reel.json": '{"version":1}' });
    const result = run(folder(), several, "init", "--title", "Shop");
    expect(result).toMatchObject({ status: 1, stderr: expect.stringContaining(join(several, "b/flow-reel.json")) });
    const data = folder();
    const root = folder({ "app/x": "" });
    expect(run(data, root, "init", "--title", "Shop")).toMatchObject({ status: 0 });
    expect(run(data, join(root, "app"), "init", "--title", "App")).toMatchObject({ status: 1, stderr: expect.stringContaining("is inside the workspace of") });
    const outer = folder();
    expect(run(data, outer, "init", "inner", "--title", "Inner")).toMatchObject({ status: 2 });
    mkdirSync(join(outer, "inner"));
    expect(run(data, outer, "init", "inner", "--title", "Inner")).toMatchObject({ status: 0 });
    expect(run(data, outer, "init", "--title", "Outer")).toMatchObject({ status: 1, stderr: expect.stringContaining("holds a workspace already, in") });
  });

  it("keeps names unique on the computer: another title, or a local alias for a clone", () => {
    const [data, shop, other] = [folder(), folder(), folder()];
    expect(run(data, shop, "init", "--title", "Shop")).toMatchObject({ status: 0 });
    expect(run(data, other, "init", "--title", "shop")).toMatchObject({ status: 1, stderr: expect.stringContaining('"shop" is already the name of Shop') });
    // Another project named Shop, made on another computer and cloned here.
    expect(run(folder(), other, "init", "--title", "Shop")).toMatchObject({ status: 0 });
    expect(() => rememberWorkspace(data, findWorkspace(other))).toThrow(SlugTakenError);
    expect(run(data, other, "init", "--alias", "Shop 2")).toMatchObject({ status: 2 });
    expect(run(data, other, "init", "--alias", "shop")).toMatchObject({ status: 1 });
    expect(run(data, other, "init", "--alias", "shop-2")).toMatchObject({ status: 0, stdout: "Shop is shop-2 on this computer\n" });
    expect(localSlug(rememberWorkspace(data, findWorkspace(other)))).toBe("shop-2");
    expect(config(other).workspace.slug).toBe("shop");
  });

  it("knows two checkouts as one workspace, and forgets one that is gone", () => {
    const [data, main, worktree] = [folder(), folder(), folder()];
    expect(run(data, main, "init", "--title", "Shop")).toMatchObject({ status: 0 });
    writeFileSync(join(worktree, "flow-reel.json"), readFileSync(join(main, "flow-reel.json")));
    expect(rememberWorkspace(data, findWorkspace(worktree)).roots).toEqual([worktree, main]);
    rmSync(main, { recursive: true });
    expect(rememberWorkspace(data, findWorkspace(worktree)).roots).toEqual([worktree]);
    // A removed project gives its name back.
    rmSync(worktree, { recursive: true });
    expect(run(data, folder(), "init", "--title", "Shop")).toMatchObject({ status: 0 });
  });
}, 60_000);

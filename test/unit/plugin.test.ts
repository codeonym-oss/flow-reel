// The agent plugin's consistency (GH-6 decisions 005, 010, 011): its manifests, skills and links agree, it
// resolves from a copy of plugin/ alone, and it claims the runtime version this package is.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const plugin = join(root, "plugin");
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const claude = json(join(plugin, ".claude-plugin/plugin.json"));
const portable = json(join(plugin, "plugin.json"));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** `>=A.B.C <X.Y.Z`, the only range form the plugin states (decision 010). */
function satisfies(version: string, range: string): boolean {
  const match = /^>=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)$/.exec(range);
  if (!match) throw new Error(`unsupported range ${range}`);
  const parts = (v: string) => v.split(/[-+]/)[0].split(".").map(Number);
  const cmp = (a: string, b: string) => {
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  return cmp(version, match[1]) >= 0 && cmp(version, match[2]) < 0;
}

function supportedRange(languageMd: string): string {
  const match = /^\*\*Supported runtime:\*\* `([^`]+)`$/m.exec(languageMd);
  if (!match) throw new Error("language.md states no supported runtime");
  return match[1];
}

describe("the plugin's manifests", () => {
  it("agree on everything they share", () => {
    for (const field of ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"]) {
      expect(portable[field], field).toEqual(claude[field]);
    }
    expect(claude.name).toBe("flow-reel");
  });

  it("list exactly the skill folders, each with a named SKILL.md", () => {
    const skillsDir = join(plugin, "skills");
    const onDisk = existsSync(skillsDir) ? readdirSync(skillsDir).filter(d => existsSync(join(skillsDir, d, "SKILL.md"))) : [];
    expect([...claude.skills].sort()).toEqual(onDisk.map(d => `./skills/${d}`).sort());
    for (const dir of onDisk) {
      const text = readFileSync(join(skillsDir, dir, "SKILL.md"), "utf8");
      const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
      expect(front, dir).not.toBeNull();
      const fields = Object.fromEntries(front![1].split("\n").map(line => line.split(/: (.*)/s).slice(0, 2)));
      expect(fields.name).toBe(dir);
      expect(fields.description.length).toBeGreaterThan(40);
    }
  });

  it("onboard with a skill that exists", () => {
    const openai = portable.extensions?.["com.openai"];
    if (openai) expect(existsSync(join(plugin, openai.onboardingSkill))).toBe(true);
  });

  it("are both versioned by the plugin's own release-please component", () => {
    const config = json(join(root, "release-please-config.json"));
    const pkg = config.packages.plugin;
    expect(pkg.component).toBe("flow-reel-plugin");
    expect(pkg["extra-files"].map((f: { path: string }) => f.path).sort()).toEqual([".claude-plugin/plugin.json", "plugin.json"]);
    expect(config.packages["."]["exclude-paths"]).toContain("plugin");
  });
});

describe("an installed copy of plugin/ alone", () => {
  const copy = mkdtempSync(join(tmpdir(), "flow-reel-plugin-"));
  cpSync(plugin, join(copy, "plugin"), { recursive: true });
  const installed = join(copy, "plugin");
  afterAll(() => rmSync(copy, { recursive: true, force: true }));

  it("resolves every relative link and <skill-dir> path, without leaving the plugin", () => {
    const broken: string[] = [];
    for (const file of files(installed).filter(f => f.endsWith(".md"))) {
      const text = readFileSync(file, "utf8");
      const targets = [
        ...[...text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)].map(m => m[1]).filter(t => !/^[a-z]+:/i.test(t)),
        ...[...text.matchAll(/<skill-dir>\/([\w./-]+)/g)].map(m => m[1]),
        ...[...text.matchAll(/`(\.\.?\/[\w./-]+)`/g)].map(m => m[1]),
      ];
      for (const target of targets) {
        const path = resolve(dirname(file), target);
        if (relative(installed, path).startsWith("..") || !existsSync(path)) broken.push(`${relative(installed, file)}: ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("what the plugin teaches", () => {
  const docs = files(plugin).filter(f => f.endsWith(".md")).map(f => ({ file: relative(plugin, f), text: readFileSync(f, "utf8") }));

  it("typechecks every script it shows against flow-reel's API", () => {
    // TypeScript 7 has no JavaScript API: write the scripts and a tsconfig extending the repository's, then run tsc.
    const dir = join(root, "node_modules/.cache/flow-reel-plugin-scripts");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    try {
      const roots = files(plugin).filter(f => f.endsWith(".ts"));
      for (const { file, text } of docs) {
        [...text.matchAll(/```ts\n([\s\S]*?)```/g)].forEach((m, i) => {
          const path = join(dir, `${file.replace(/[/.]/g, "_")}_${i}.ts`);
          writeFileSync(path, m[1]);
          roots.push(path);
        });
      }
      expect(roots.length).toBeGreaterThan(8);
      writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ extends: join(root, "tsconfig.json"), include: [], files: roots }));
      const result = spawnSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", join(dir, "tsconfig.json"), "--noEmit"], { encoding: "utf8" });
      expect(result.stdout + result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);

  it("uses only the commands and flags the CLI has", () => {
    const usage = readFileSync(join(root, "src/cli.ts"), "utf8").match(/const USAGE = ([\s\S]*?);\n/)![1];
    const flags = new Set(usage.match(/--[a-z-]+/g));
    const wrong: string[] = [];
    for (const { file, text } of docs) {
      for (const [line] of text.matchAll(/npx flow-reel (\S+)[^\n`]*/g)) {
        if (!["compose", "verify", "compare"].includes(line.split(" ")[2])) wrong.push(`${file}: ${line}`);
        for (const flag of line.match(/--[a-z-]+/g) ?? []) if (!flags.has(flag)) wrong.push(`${file}: ${flag}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("doesn't teach the 0.1 words", () => {
    const old = docs.filter(({ text }) => /\b(demo|step|sfx)\(|--no-sfx|flow-reel record|\.transcript\.json/.test(text)).map(d => d.file);
    expect(old).toEqual([]);
  });
});

describe("the supported runtime (decision 010)", () => {
  const range = supportedRange(readFileSync(join(plugin, "references/language.md"), "utf8"));

  it("includes this package's version", () => {
    expect(satisfies(json(join(root, "package.json")).version, range)).toBe(true);
  });

  it("is read as a half-open range", () => {
    expect(satisfies("0.2.0", ">=0.2.0 <0.3.0")).toBe(true);
    expect(satisfies("0.2.9", ">=0.2.0 <0.3.0")).toBe(true);
    expect(satisfies("0.3.0", ">=0.2.0 <0.3.0")).toBe(false);
    expect(satisfies("0.1.2", ">=0.2.0 <0.3.0")).toBe(false);
  });
});

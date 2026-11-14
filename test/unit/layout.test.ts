import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { expect, it } from "vitest";

const src = resolve(import.meta.dirname, "../../src");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);

// GH-27 decisions 006 and 007: the core reaches an E2E tool, a voice or a reel's layout only through a port.
it("keeps the composer core free of Playwright and of the adapters", () => {
  const core = files(join(src, "composer"));
  expect(core.length).toBeGreaterThan(10);
  const offenders = core.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/from\s+"([^"]+)"|import\("([^"]+)"\)/g)]
      .map((match) => match[1] ?? match[2])
      .filter((specifier) => specifier === "playwright" || specifier.startsWith("playwright/") || /(^|\/)adapters\//.test(specifier))
      .map((specifier) => `${relative(src, file)} imports ${specifier}`));
  expect(offenders).toEqual([]);
});

// Some modules find package files by counting folders up from their own location; dist/ mirrors src/ one-to-one,
// so a lookup that resolves here resolves in the built package and the image too.
it("resolves every path a module computes from its own location", () => {
  const root = resolve(src, "..");
  const lookups = files(src).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/new URL\(\s*[`"]([^`"]+)[`"],\s*import\.meta\.url\)|resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\),\s*"([^"]+)"\)/g)]
      .map((match) => ({ file, path: (match[1] ?? match[2]).replace(/\$\{[^}]+\}/g, ".ts") })));
  expect(lookups.length).toBeGreaterThanOrEqual(4);
  const wrong = lookups.flatMap(({ file, path }) => {
    const target = resolve(dirname(file), path);
    const ok = /^(\.\.\/?)+$/.test(path) ? target === root : existsSync(target);
    return ok ? [] : [`${relative(src, file)}: "${path}" -> ${relative(root, target) || "."}`];
  });
  expect(wrong).toEqual([]);
});

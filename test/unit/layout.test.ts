import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, it } from "vitest";

const src = resolve(import.meta.dirname, "../../src");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);

// GH-27 decisions 006 and 007: the core reaches an E2E tool, a voice or a cassette's layout only through a port.
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

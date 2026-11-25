import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { expect, it } from "vitest";

const src = resolve(import.meta.dirname, "../../src");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);

const importsOf = (file: string): string[] => [...readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)[^;]*?from\s+"([^"]+)"|^import\s+"([^"]+)"|import\("([^"]+)"\)/gm)]
  .map((match) => match[1] ?? match[2] ?? match[3])
  .map((specifier) => specifier.startsWith(".") ? relative(src, resolve(dirname(file), specifier)).split(sep).join("/") : specifier);

/**
 * What each part of the source may not import (epic GH-107 decisions 004, 030 and 031; GH-27 decisions 006 and 007). A
 * type-only import is free: nothing of it is there at run time. A new folder must be added here.
 */
const FENCES: { part: RegExp; why: string; forbidden: RegExp }[] = [
  { part: /^run\//, why: "the run engine is pure", forbidden: /^(node:|playwright|adapters\/|host\/|cli|container\/|workspace\/|composer\/media\/|composer\/phases\/)/ },
  { part: /^composer\/(?!media\/|phases\/)/, why: "the composer's core reaches a process, a server, a database or an E2E tool only through a port",
    forbidden: /^(node:(child_process|net|http|https|sqlite|worker_threads)|playwright|adapters\/|host\/|cli|container\/|workspace\/|run\/|composer\/media\/|composer\/phases\/)/ },
  { part: /^composer\/(media|phases)\//, why: "the container's phases know no host, database or E2E tool", forbidden: /^(node:(net|http|https|sqlite)|playwright|adapters\/|host\/|cli|container\/|workspace\/|run\/)/ },
  { part: /^composer\/phases\/plan\.ts$/, why: "planning is pure", forbidden: /^(node:|composer\/media\/)/ },
  { part: /^adapters\/(?!folder\/)/, why: "an adapter implements a port, inside the container", forbidden: /^(host\/|cli|container\/|run\/|node:sqlite)/ },
  { part: /^adapters\/folder\//, why: "the folder store moves files on the host", forbidden: /^(node:(child_process|net|http|https|sqlite)|playwright|composer\/media\/|composer\/phases\/|cli|container\/|run\/)/ },
  { part: /^container\/main\.ts$/, why: "the container knows no host", forbidden: /^(host\/|cli|run\/|node:sqlite)/ },
  { part: /^container\/protocol\.ts$/, why: "both sides read the protocol", forbidden: /^(node:|playwright|adapters\/|host\/|cli)/ },
  { part: /^workspace\//, why: "a workspace is files and their rules", forbidden: /^(node:(child_process|net|http|https|sqlite)|playwright|adapters\/|host\/|cli|container\/|run\/)/ },
  { part: /^host\//, why: "the host runs no browser and no ffmpeg: those are in the container", forbidden: /^(playwright|adapters\/(?!folder\/)|composer\/media\/|composer\/phases\/(?!plan\.ts)|cli|container\/main\.ts)/ },
  { part: /^cli\//, why: "a command asks the host", forbidden: /^(playwright|adapters\/|composer\/|container\/|node:(child_process|net|http|https|sqlite))/ },
  { part: /^(index|cli|compare|reel|settings)\.ts$/, why: "the package's entry points stay light", forbidden: /^(playwright|adapters\/|composer\/(media|phases)\/|container\/|node:(child_process|net|http|https|sqlite))/ },
];

it("keeps each part of the source inside its fence", () => {
  const all = files(src).map((file) => ({ file, name: relative(src, file).split(sep).join("/") }));
  expect(all.filter(({ name }) => !FENCES.some(({ part }) => part.test(name))).map(({ name }) => name)).toEqual([]);
  expect(all.flatMap(({ file, name }) => FENCES.filter(({ part }) => part.test(name)).flatMap(({ forbidden, why }) =>
    importsOf(file).filter((specifier) => forbidden.test(specifier)).map((specifier) => `${name} imports ${specifier}: ${why}`)))).toEqual([]);
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

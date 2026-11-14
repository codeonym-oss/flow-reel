// A reel folder on disk: list and hash its files, and check it against its manifest (GH-31 decisions 002-004).
// Runs on the host as well as in the composer, without Docker or FFmpeg.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Manifest, type ManifestFile, validateManifest } from "./composer/schema/manifest.ts";

export const MANIFEST = "manifest.json";

/** Every regular file of the reel, relative and sorted, leaving out manifest.json and work/. */
export function listReelFiles(dir: string): string[] {
  const walk = (rel: string): string[] => readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((entry) => {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return path === "work" ? [] : walk(path);
    return entry.isFile() && path !== MANIFEST ? [path] : [];
  });
  return walk("").sort();
}

export function hashFiles(dir: string, paths: readonly string[]): ManifestFile[] {
  return paths.map((path) => {
    const bytes = readFileSync(join(dir, path));
    return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
}

/** Errors mean the folder isn't a readable reel; differences name each file that doesn't match the manifest. */
export function verifyReel(dir: string): { errors: string[]; differences: string[]; manifest?: Manifest } {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return { errors: ["not a folder"], differences: [] };
  let manifest: unknown;
  try { manifest = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8")); }
  catch (error) { return { errors: [`${MANIFEST}: ${(error as Error).message}`], differences: [] }; }
  const errors = validateManifest(manifest).map((e) => `${MANIFEST}: ${e}`);
  if (errors.length) return { errors, differences: [] };
  const listed = new Map((manifest as Manifest).files.map((file) => [file.path, file]));
  const present = listReelFiles(dir);
  const differences = [
    ...[...listed.keys()].filter((path) => !present.includes(path)).map((path) => `${path} is missing`),
    ...present.filter((path) => !listed.has(path)).map((path) => `${path} is not in the manifest`),
    ...hashFiles(dir, present.filter((path) => listed.has(path)))
      .filter(({ path, bytes, sha256 }) => listed.get(path)!.bytes !== bytes || listed.get(path)!.sha256 !== sha256)
      .map(({ path }) => `${path} changed`),
  ];
  return { errors, differences, manifest: manifest as Manifest };
}

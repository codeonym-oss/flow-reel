// Files on this computer: copies, hashes, and changes that are complete or haven't happened.
import { createHash } from "node:crypto";
import { closeSync, constants, copyFileSync, createReadStream, fsyncSync, linkSync, mkdirSync, openSync, readdirSync, readlinkSync,
  statSync, symlinkSync, writeFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export interface FileEntry { path: string; bytes: number; sha256: string }

export async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

export const sha256Text = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Every regular file of a folder, relative with forward slashes and sorted; `skip` leaves out an entry and what it holds. */
export function listFiles(dir: string, skip: (path: string) => boolean = () => false): string[] {
  const walk = (at: string): string[] => readdirSync(join(dir, at), { withFileTypes: true }).flatMap((entry) => {
    const path = at ? `${at}/${entry.name}` : entry.name;
    if (skip(path)) return [];
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() ? [path] : [];
  });
  return walk("").sort();
}

/** Each listed file's size and hash. */
export async function describeFiles(dir: string, paths: readonly string[]): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  // One at a time: a folder can hold more files than a process may have open.
  for (const path of paths) {
    const file = join(dir, path);
    entries.push({ path, bytes: statSync(file).size, sha256: await sha256(file) });
  }
  return entries;
}

/** One hash for a set of files: their paths and contents, whatever order they come in. */
export const treeHash = (files: readonly FileEntry[]): string =>
  sha256Text([...files].sort((a, b) => (a.path < b.path ? -1 : 1)).map(({ path, sha256 }) => `${sha256}  ${path}\n`).join(""));

/** Copies a file, sharing its blocks where the disk can. */
export function copyFile(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to, constants.COPYFILE_FICLONE);
}

/** Copies a folder's files and symbolic links; `skip` leaves out an entry and what it holds. */
export function copyTree(from: string, to: string, skip: (path: string) => boolean = () => false): void {
  const walk = (at: string) => {
    mkdirSync(join(to, at), { recursive: true });
    for (const entry of readdirSync(join(from, at), { withFileTypes: true })) {
      const path = at ? `${at}/${entry.name}` : entry.name;
      if (skip(path)) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) copyFile(join(from, path), join(to, path));
      else if (entry.isSymbolicLink()) copyLink(join(from, path), join(to, path));
    }
  };
  walk("");
}

/** A link stays a link where the system allows it; a link to a file is copied as the file elsewhere (Windows). */
function copyLink(from: string, to: string): void {
  try { symlinkSync(readlinkSync(from), to); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    if (statSync(from, { throwIfNoEntry: false })?.isFile()) copyFile(from, to);
  }
}

/** Gives a finished file a second name, without copying it where the disk can; neither may be changed afterwards. */
export function linkFile(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  try { linkSync(from, to); }
  catch { copyFile(from, to); }
}

/** Writes a file that is on the disk, whole, when this returns. */
export function writeDurable(file: string, text: string): void {
  writeFileSync(file, text, { flush: true });
}

/** Makes sure a folder's files are on the disk, so that a power cut doesn't leave a named file empty. */
export function syncTree(dir: string): void {
  for (const path of listFiles(dir)) {
    // Windows syncs only what was opened for writing.
    const descriptor = openSync(join(dir, path), "r+");
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
  }
}

const BUSY = ["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"];
const RETRY_MS = 100;

/** Renames, waiting up to `waitMs` on Windows for a program that has a file inside open (a player, an antivirus). */
export async function renameWhenFree(from: string, to: string, waitMs = process.platform === "win32" ? 5000 : 0): Promise<void> {
  for (const deadline = Date.now() + waitMs; ;) {
    try { return await rename(from, to); }
    catch (error) {
      if (!BUSY.includes((error as NodeJS.ErrnoException).code ?? "") || Date.now() >= deadline) throw error;
      await sleep(RETRY_MS);
    }
  }
}

/** A path with the system's separators as one with forward slashes. */
export const slashes = (path: string): string => path.split(sep).join("/");

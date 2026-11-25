// The reel store as a local folder (GH-31 decisions 001 and 002): a finished reel is swapped in whole.
import { lstatSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { ReelStore } from "../../composer/ports.ts";
import { copyTree, renameWhenFree, syncTree } from "../../host/files.ts";

const exists = (path: string) => lstatSync(path, { throwIfNoEntry: false }) !== undefined;

/**
 * Replaces the folder `to` with a copy of `from`, whole: it is copied beside `to`, so the last step is a rename on one
 * disk. An interrupted replacement leaves the old folder or the new one, and calling this again finishes it.
 */
async function publish(from: string, to: string): Promise<void> {
  const beside = (kind: string) => join(dirname(to), `.${basename(to)}.${kind}`);
  const [next, last] = [beside("new"), beside("old")];
  const clear = (path: string) => rm(path, { recursive: true, force: true, maxRetries: 3 });
  mkdirSync(dirname(to), { recursive: true });
  if (exists(last) && !exists(to)) await renameWhenFree(last, to);
  await clear(next);
  await clear(last);
  try {
    copyTree(from, next);
    syncTree(next);
    if (exists(to)) await renameWhenFree(to, last);
    try { await renameWhenFree(next, to); }
    catch (error) {
      if (exists(last)) await renameWhenFree(last, to);
      throw error;
    }
  } catch (error) {
    await clear(next);
    throw new Error(`${to} can't be replaced: ${(error as Error).message}`, { cause: error });
  }
  await clear(last);
}

export const folderStore: ReelStore = { publish };

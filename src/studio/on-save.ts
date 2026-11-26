// Run again on save (GH-136 decision 004): while a script's switch is on, a save that changes it starts a run; a save while
// one is going waits for it, and several such saves make one run. The switches live as long as the studio.
import { type FSWatcher, readFileSync, watch } from "node:fs";
import { basename, dirname } from "node:path";
import { sha256Text } from "../host/files.ts";

export interface OnSaveHooks {
  /** Starts a run of the script. */
  start(file: string): Promise<void>;
  /** Whether a run of the script is going on. */
  going(file: string): boolean;
}

const SETTLE_MS = 300;
const CHECK_MS = 1000;

interface Watched { watcher: FSWatcher; hash: string | undefined; timer?: NodeJS.Timeout; pending: boolean; starting: boolean }

export class OnSave {
  readonly #watched = new Map<string, Watched>();
  /** Why the last run a save started couldn't start, by script. */
  readonly #failed = new Map<string, string>();
  readonly #hooks: OnSaveHooks;
  readonly #check: NodeJS.Timeout;

  constructor(hooks: OnSaveHooks) {
    this.#hooks = hooks;
    this.#check = setInterval(() => { for (const file of this.#watched.keys()) this.#tryStart(file); }, CHECK_MS);
    this.#check.unref();
  }

  isOn(file: string): boolean { return this.#watched.has(file); }

  /** Why the last run a save of this script started couldn't start. */
  failure(file: string): string | undefined { return this.#failed.get(file); }

  set(file: string, on: boolean): void {
    const was = this.#watched.get(file);
    this.#failed.delete(file);
    if (!on) {
      if (was) { was.watcher.close(); clearTimeout(was.timer); this.#watched.delete(file); }
      return;
    }
    if (was) return;
    // The folder, not the file: an editor that saves by renaming replaces the file a watcher holds.
    const watcher = watch(dirname(file), (_event, name) => { if (name === null || name === basename(file)) this.#changed(file); });
    this.#watched.set(file, { watcher, hash: this.#hash(file), pending: false, starting: false });
  }

  close(): void {
    clearInterval(this.#check);
    for (const file of [...this.#watched.keys()]) this.set(file, false);
  }

  #hash(file: string): string | undefined {
    try { return sha256Text(readFileSync(file, "utf8")); } catch { return undefined; }
  }

  #changed(file: string): void {
    const watched = this.#watched.get(file);
    if (!watched) return;
    clearTimeout(watched.timer);
    watched.timer = setTimeout(() => {
      const hash = this.#hash(file);
      if (hash === undefined || hash === watched.hash) return;
      watched.hash = hash;
      watched.pending = true;
      this.#tryStart(file);
    }, SETTLE_MS);
  }

  #tryStart(file: string): void {
    const watched = this.#watched.get(file);
    if (!watched?.pending || watched.starting || this.#hooks.going(file)) return;
    watched.pending = false;
    watched.starting = true;
    this.#failed.delete(file);
    this.#hooks.start(file).catch((error: Error) => { this.#failed.set(file, error.message); }).finally(() => { watched.starting = false; });
  }
}

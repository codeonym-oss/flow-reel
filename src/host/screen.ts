// The live picture in a run's process (GH-138 decisions 001 and 002): who watches, the record container to tell, and
// the pictures passed on, the newest only to a watcher that is busy.
import type { ContainerInput } from "../container/protocol.ts";

/** Wraps a sender so that, while one item is on its way, only the newest one waits. `send` calls `sent` once it left. */
export function newestOnly<T>(send: (item: T, sent: () => void) => void): (item: T) => void {
  let busy = false;
  let waiting: { item: T } | undefined;
  const go = (item: T) => {
    busy = true;
    send(item, () => {
      busy = false;
      const next = waiting;
      waiting = undefined;
      if (next) go(next.item);
    });
  };
  return (item) => { if (busy) waiting = { item }; else go(item); };
}

export class Screen {
  readonly #watchers = new Set<(jpeg: string) => void>();
  #tell: ((input: ContainerInput) => void) | undefined;

  /** A record container that can grab the screen; it is told at once whether someone watches. Returns its detach. */
  attach(tell: (input: ContainerInput) => void): () => void {
    this.#tell = tell;
    if (this.#watchers.size) tell("watch");
    return () => { if (this.#tell === tell) this.#tell = undefined; };
  }

  /** Someone watches until the returned function is called. */
  watch(picture: (jpeg: string) => void): () => void {
    this.#watchers.add(picture);
    if (this.#watchers.size === 1) this.#tell?.("watch");
    return () => { if (this.#watchers.delete(picture) && !this.#watchers.size) this.#tell?.("unwatch"); };
  }

  picture(jpeg: string): void { for (const watcher of this.#watchers) watcher(jpeg); }
}

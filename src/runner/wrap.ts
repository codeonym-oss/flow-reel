// The page a demo script receives (GH-2 decision 002): plain Playwright, except that actions ease the mouse to their
// target, type visibly, and append what they did to the event log (story decision 013).
import type { Locator, Page } from "playwright";
import type { Bounds, Point, RunnerEvent } from "../schema/events.ts";
import { easeInOutCubic, moveDuration, pathPoints } from "./easing.ts";

export interface WrapOptions {
  /** Milliseconds on the recording's clock. */
  clock: { now(): number };
  events: RunnerEvent[];
  sleep?: (ms: number) => Promise<void>;
  warn?: (message: string) => void;
  fps?: number;
  /** CSS pixels; defaults to the page's emulated viewport. */
  viewport?: [width: number, height: number];
}

const CHAR_DELAY_MS = 60;
// Each phase of an action lasts at least this long, so the jitter of Playwright's round-trips (worse while ffmpeg
// encodes) is absorbed inside the phase instead of shifting everything after it (story decision 009).
const BUDGET_MS = { locate: 150, settle: 250, act: 400, clear: 100, typeTail: 200, moveTail: 30 };

// Methods that return a locator (or a frame locator, whose methods do), so the result is wrapped too.
const LOCATOR_FACTORIES = new Set([
  "locator", "getByRole", "getByText", "getByLabel", "getByPlaceholder", "getByAltText", "getByTitle", "getByTestId",
  "first", "last", "nth", "filter", "and", "or", "frameLocator", "owner",
]);
// page.<action>(selector, ...rest) runs as locator(selector).<action>(...rest), so it is animated the same way.
const PAGE_SELECTOR_ACTIONS = new Set([
  "click", "dblclick", "hover", "check", "uncheck", "setChecked", "fill", "type", "selectOption",
]);
// Actions that move the pointer or the page but that the wrapper can't animate: they run as is, with a warning.
const PAGE_UNCOVERED = new Set([
  "press", "tap", "dragAndDrop", "setInputFiles", "evaluate", "evaluateHandle", "dispatchEvent", "focus",
]);
const LOCATOR_UNCOVERED = new Set(["tap", "dragTo", "setInputFiles", "dispatchEvent", "evaluate", "evaluateAll", "focus"]);
const MOUSE_UNCOVERED = new Set(["move", "click", "dblclick", "down", "up"]);

export function wrapPage(page: Page, options: WrapOptions): Page {
  const { clock, events, fps = 30 } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const warned = new Set<string>();
  const [vw, vh] = options.viewport ?? [page.viewportSize()?.width ?? 1920, page.viewportSize()?.height ?? 1080];
  const viewport = { width: vw, height: vh };
  let pointer: Point = [viewport.width / 2, viewport.height / 2];

  const warnOnce = (name: string) => {
    if (warned.has(name)) return;
    warned.add(name);
    (options.warn ?? console.warn)(`${name}() runs without cursor motion`);
  };

  // Runs `frame(i, frames)` once per video frame, paced on the clock so the whole thing lasts `durationMs`.
  async function animate(durationMs: number, frame: (i: number, frames: number) => Promise<void>) {
    const start = clock.now();
    const frames = Math.max(1, Math.round((durationMs / 1000) * fps));
    for (let i = 0; i < frames; i++) {
      await frame(i, frames);
      await sleep(Math.max(0, start + (durationMs * (i + 1)) / frames - clock.now()));
    }
  }

  async function paced<T>(budgetMs: number, fn: () => Promise<T>): Promise<T> {
    const start = clock.now();
    const result = await fn();
    await sleep(Math.max(0, start + budgetMs - clock.now()));
    return result;
  }

  async function moveTo(to: Point) {
    const from = pointer;
    const durationMs = moveDuration(from, to);
    events.push({ t: clock.now(), type: "move", from, to, durationMs, easing: "easeInOutCubic" });
    const points = pathPoints(from, to, durationMs, fps);
    await animate(durationMs, async (i) => page.mouse.move(points[i][0], points[i][1]));
    pointer = to;
  }

  const scrollDuration = (dx: number, dy: number) => Math.round(Math.min(1000, 300 + Math.hypot(dx, dy) * 0.25));

  async function wheel(dx: number, dy: number) {
    const durationMs = scrollDuration(dx, dy);
    events.push({ t: clock.now(), type: "scroll", delta: [dx, dy], durationMs });
    let done: Point = [0, 0];
    await animate(durationMs, async (i, frames) => {
      const k = easeInOutCubic((i + 1) / frames);
      const next: Point = [dx * k, dy * k];
      await page.mouse.wheel(next[0] - done[0], next[1] - done[1]);
      done = next;
    });
  }

  // Scrolls the target to the middle of the viewport when it is off screen, then eases the mouse to its centre.
  async function approach(locator: Locator): Promise<{ at: Point; bounds: Bounds } | undefined> {
    let box = await paced(BUDGET_MS.locate, () => locator.boundingBox());
    if (!box) return undefined;
    const centreY = box.y + box.height / 2;
    if (centreY < 0 || centreY > viewport.height) {
      const dy = Math.round(centreY - viewport.height / 2);
      box = await paced(scrollDuration(0, dy) + BUDGET_MS.settle, async () => {
        await wheel(0, dy);
        return (await locator.boundingBox()) ?? box!;
      });
    }
    const at: Point = [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
    await paced(moveDuration(pointer, at) + BUDGET_MS.moveTail, () => moveTo(at));
    return { at, bounds: box };
  }

  const logClick = (position: { at: Point; bounds: Bounds } | undefined, target: string) => {
    if (position) events.push({ t: clock.now(), type: "click", ...position, button: "left", target });
  };

  function wrapLocator(locator: Locator): Locator {
    const target = String(locator);
    // A click is logged when Playwright's call returns: it presses only after checks that wait for frames to render,
    // which take ~100 ms and longer under load, so logging before the call would put the click early.
    const actions: Record<string, (original: Function, args: unknown[]) => Promise<unknown>> = {
      async click(original, args) { return act(original, args, await approach(locator)); },
      async dblclick(original, args) { return act(original, args, await approach(locator), 2); },
      async hover(original, args) { await approach(locator); return act(original, args); },
      async check(original, args) { return act(original, args, await approach(locator)); },
      async uncheck(original, args) { return act(original, args, await approach(locator)); },
      async setChecked(original, args) { return act(original, args, await approach(locator)); },
      async selectOption(original, args) { return act(original, args, await approach(locator)); },
      async scrollIntoViewIfNeeded(original, args) { await approach(locator); return act(original, args); },
      async fill(original, args) {
        const position = await approach(locator);
        await act(() => locator.click(), [], position);
        await paced(BUDGET_MS.clear, () => original(""));
        return typeText(String(args[0]), position?.bounds);
      },
      async type(_original, args) {
        const position = await approach(locator);
        await act(() => locator.click(), [], position);
        return typeText(String(args[0]), position?.bounds);
      },
      async pressSequentially(_original, args) {
        const position = await approach(locator);
        await act(() => locator.click(), [], position);
        return typeText(String(args[0]), position?.bounds);
      },
    };
    const act = (original: Function, args: unknown[], clickAt?: { at: Point; bounds: Bounds }, clicks = 1) =>
      paced(BUDGET_MS.act, async () => {
        const result = await original(...args);
        for (let i = 0; i < clicks; i++) logClick(clickAt, target);
        return result;
      });
    async function typeText(text: string, bounds?: Bounds) {
      events.push({ t: clock.now(), type: "type", text, charDelayMs: CHAR_DELAY_MS, target, ...(bounds ? { bounds } : {}) });
      await paced(text.length * CHAR_DELAY_MS + BUDGET_MS.typeTail,
        () => locator.pressSequentially(text, { delay: CHAR_DELAY_MS }));
    }

    return new Proxy(locator, {
      get(obj, prop, receiver) {
        const value = Reflect.get(obj, prop, receiver);
        if (typeof prop !== "string" || typeof value !== "function") return value;
        const original = value.bind(obj);
        if (prop in actions) return (...args: unknown[]) => actions[prop](original, args);
        if (LOCATOR_FACTORIES.has(prop)) return (...args: unknown[]) => wrapLocator(original(...args));
        if (LOCATOR_UNCOVERED.has(prop)) return (...args: unknown[]) => { warnOnce(`locator.${prop}`); return original(...args); };
        return original;
      },
    });
  }

  const mouse = new Proxy(page.mouse, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      if (prop === "wheel") return (dx: number, dy: number) => wheel(dx, dy);
      const original = value.bind(obj);
      if (MOUSE_UNCOVERED.has(prop)) return (...args: unknown[]) => { warnOnce(`page.mouse.${prop}`); return original(...args); };
      return original;
    },
  });

  return new Proxy(page, {
    get(obj, prop, receiver) {
      if (prop === "mouse") return mouse;
      if (typeof prop === "string" && PAGE_SELECTOR_ACTIONS.has(prop)) {
        return (selector: string, ...rest: unknown[]) =>
          (wrapLocator(obj.locator(selector)) as unknown as Record<string, Function>)[prop](...rest);
      }
      const value = Reflect.get(obj, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      const original = value.bind(obj);
      if (LOCATOR_FACTORIES.has(prop)) return (...args: unknown[]) => wrapLocator(original(...args));
      if (PAGE_UNCOVERED.has(prop)) return (...args: unknown[]) => { warnOnce(`page.${prop}`); return original(...args); };
      return original;
    },
  });
}

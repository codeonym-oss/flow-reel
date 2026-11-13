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
  "first", "last", "nth", "filter", "and", "or", "frameLocator", "owner", "contentFrame",
]);
// page.<action>(selector, ...rest) runs as locator(selector).<action>(...rest), so it is animated the same way.
const PAGE_SELECTOR_ACTIONS = new Set([
  "click", "dblclick", "hover", "check", "uncheck", "setChecked", "fill", "type", "selectOption",
]);
// Calls that act on the page (or hand out objects that do) but that the wrapper can't animate: they run as is,
// with a warning.
const PAGE_UNCOVERED = new Set([
  "press", "tap", "dragAndDrop", "setInputFiles", "evaluate", "evaluateHandle", "dispatchEvent", "focus",
  "frame", "frames", "mainFrame",
]);
const LOCATOR_UNCOVERED = new Set([
  "tap", "dragTo", "setInputFiles", "dispatchEvent", "evaluate", "evaluateAll", "focus", "press", "clear", "selectText",
]);
const MOUSE_UNCOVERED = new Set(["move", "click", "dblclick", "down", "up"]);
const KEYBOARD_UNCOVERED = new Set(["press", "down", "up", "insertText"]);
// Inputs Playwright fills by setting their value: typing into them character by character doesn't work.
const VALUE_INPUT_TYPES = ["date", "datetime-local", "month", "week", "time", "color", "range"];

type Button = "left" | "right" | "middle";
interface ActionOptions { button?: Button; position?: { x: number; y: number }; timeout?: number; force?: boolean }
const optionsOf = (value: unknown): ActionOptions => (value && typeof value === "object" ? value as ActionOptions : {});

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

  const offScreen = (box: Bounds) => {
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    return x < 0 || x > viewport.width || y < 0 || y > viewport.height;
  };

  // Scrolls the target to the middle of the viewport when it is off screen, then eases the mouse to its centre (or
  // to `position`, relative to its top-left corner, as Playwright's own option means).
  async function approach(locator: Locator, position?: { x: number; y: number }):
    Promise<{ at: Point; bounds: Bounds } | undefined> {
    let box = await paced(BUDGET_MS.locate, () => locator.boundingBox());
    if (!box) return undefined;
    if (offScreen(box)) {
      const dy = Math.round(box.y + box.height / 2 - viewport.height / 2);
      box = await paced(scrollDuration(0, dy) + BUDGET_MS.settle, async () => {
        // The wheel scrolls whatever is under the pointer, which may be a nested scroller rather than the page, and
        // only vertically: when the target is still off screen, let Playwright scroll it in instead.
        if (dy) await wheel(0, dy);
        let next = (await locator.boundingBox()) ?? box!;
        if (offScreen(next)) {
          await locator.scrollIntoViewIfNeeded();
          next = (await locator.boundingBox()) ?? next;
        }
        return next;
      });
    }
    const at: Point = position
      ? [Math.round(box.x + position.x), Math.round(box.y + position.y)]
      : [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
    await paced(moveDuration(pointer, at) + BUDGET_MS.moveTail, () => moveTo(at));
    return { at, bounds: box };
  }

  const logClick = (position: { at: Point; bounds: Bounds } | undefined, target: string, button: Button = "left") => {
    if (position) events.push({ t: clock.now(), type: "click", ...position, button, target });
  };

  // Logs the typing intent, then types at the fixed readable speed.
  async function typeText(text: string, target: string, bounds: Bounds | undefined, press: (text: string) => Promise<unknown>) {
    events.push({ t: clock.now(), type: "type", text, charDelayMs: CHAR_DELAY_MS, target, ...(bounds ? { bounds } : {}) });
    await paced(text.length * CHAR_DELAY_MS + BUDGET_MS.typeTail, () => press(text));
  }

  function wrapLocator(locator: Locator): Locator {
    const target = String(locator);
    const typeInto = (text: string, bounds: Bounds | undefined, timeout?: number) =>
      typeText(text, target, bounds, (t) => locator.pressSequentially(t, { delay: CHAR_DELAY_MS, timeout }));
    // Typing sets these inputs' values only through fill(); a click would also open the browser's picker.
    const setsValueDirectly = async () => {
      try {
        return await locator.evaluate((el, types) => el instanceof HTMLInputElement && types.includes(el.type), VALUE_INPUT_TYPES);
      } catch { return false; }
    };
    // A click is logged when Playwright's call returns: it presses only after checks that wait for frames to render,
    // which take ~100 ms and longer under load, so logging before the call would put the click early.
    const clickAction = (clicks: number) => async (original: Function, args: unknown[]) => {
      const { button, position } = optionsOf(args[0]);
      return act(original, args, await approach(locator, position), clicks, button);
    };
    const actions: Record<string, (original: Function, args: unknown[]) => Promise<unknown>> = {
      click: clickAction(1),
      // Both presses are logged; effects play one sound and one ripple for clicks at the same moment and point.
      dblclick: clickAction(2),
      async hover(original, args) { await approach(locator, optionsOf(args[0]).position); return act(original, args); },
      async check(original, args) { return act(original, args, await approach(locator, optionsOf(args[0]).position)); },
      async uncheck(original, args) { return act(original, args, await approach(locator, optionsOf(args[0]).position)); },
      async setChecked(original, args) { return act(original, args, await approach(locator, optionsOf(args[1]).position)); },
      async selectOption(original, args) { return act(original, args, await approach(locator)); },
      async scrollIntoViewIfNeeded(original, args) { await approach(locator); return act(original, args); },
      async fill(original, args) {
        const { timeout, force } = optionsOf(args[1]);
        const direct = setsValueDirectly();
        const position = await approach(locator);
        if (await direct) return act(original, args);
        await act(() => locator.click({ timeout, force }), [], position);
        await paced(BUDGET_MS.clear, () => original("", optionsOf(args[1])));
        return typeInto(String(args[0]), position?.bounds, timeout);
      },
      async type(_original, args) {
        const position = await approach(locator);
        await act(() => locator.click({ timeout: optionsOf(args[1]).timeout }), [], position);
        return typeInto(String(args[0]), position?.bounds, optionsOf(args[1]).timeout);
      },
      async pressSequentially(_original, args) {
        const position = await approach(locator);
        await act(() => locator.click({ timeout: optionsOf(args[1]).timeout }), [], position);
        return typeInto(String(args[0]), position?.bounds, optionsOf(args[1]).timeout);
      },
      // Each locator all() hands out is wrapped, so looping over matches animates like any other locator.
      async all(original, args) { return ((await original(...args)) as Locator[]).map(wrapLocator); },
    };
    const act = (original: Function, args: unknown[], clickAt?: { at: Point; bounds: Bounds }, clicks = 1, button?: Button) =>
      paced(BUDGET_MS.act, async () => {
        const result = await original(...args);
        for (let i = 0; i < clicks; i++) logClick(clickAt, target, button);
        return result;
      });

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

  // keyboard.type types at the same readable speed as a locator's, logged without a target box.
  const keyboard = new Proxy(page.keyboard, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      const original = value.bind(obj);
      if (prop === "type") {
        return (text: string) => typeText(String(text), "keyboard", undefined, (t) => original(t, { delay: CHAR_DELAY_MS }));
      }
      if (KEYBOARD_UNCOVERED.has(prop)) return (...args: unknown[]) => { warnOnce(`page.keyboard.${prop}`); return original(...args); };
      return original;
    },
  });

  return new Proxy(page, {
    get(obj, prop, receiver) {
      if (prop === "mouse") return mouse;
      if (prop === "keyboard") return keyboard;
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

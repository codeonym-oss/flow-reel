import { beforeEach, describe, expect, it } from "vitest";
import type { Page } from "playwright";
import type { RunnerEvent } from "../../src/schema/events.ts";
import { wrapPage } from "../../src/runner/wrap.ts";

// A fake of the Playwright surface the wrapper touches: the page, its mouse and locators. Every call lands in `calls`.
interface Box { x: number; y: number; width: number; height: number }

function fakePage(boxes: Record<string, Box>, boxLatencyMs = 0, clickLatencyMs = 0, removeOnClick = false,
  inputTypes: Record<string, string> = {}) {
  const calls: string[] = [];
  let scrollX = 0;
  let scrollY = 0;
  const describe = (o?: { button?: string; timeout?: number }) =>
    `${o?.button ? ` ${o.button}` : ""}${o?.timeout ? ` timeout=${o.timeout}` : ""}`;
  const locator = (name: string): Record<string, unknown> => ({
    toString: () => name,
    boundingBox: async () => {
      now += boxLatencyMs;
      const b = boxes[name];
      return b && { ...b, x: b.x - scrollX, y: b.y - scrollY };
    },
    click: async (o?: { button?: string; timeout?: number }) => {
      now += clickLatencyMs; calls.push(`click ${name}${describe(o)}`); if (removeOnClick) delete boxes[name];
    },
    dblclick: async () => void calls.push(`dblclick ${name}`),
    hover: async () => void calls.push(`hover ${name}`),
    fill: async (v: string, o?: { timeout?: number }) => void calls.push(`fill ${name} "${v}"${describe(o)}`),
    pressSequentially: async (v: string, o: { delay: number; timeout?: number }) =>
      void calls.push(`pressSequentially ${name} "${v}" ${o.delay}${describe(o)}`),
    press: async (key: string) => void calls.push(`press ${name} ${key}`),
    evaluate: async (_fn: unknown, types: string[]) => types.includes(inputTypes[name]),
    scrollIntoViewIfNeeded: async () => {
      const b = boxes[name];
      scrollX = b.x + b.width / 2 - 960;
      scrollY = b.y + b.height / 2 - 540;
      calls.push(`scrollIntoViewIfNeeded ${name}`);
    },
    first: () => locator(`${name}.first()`),
    all: async () => [locator(`${name} >> nth=0`), locator(`${name} >> nth=1`)],
    dispatchEvent: async () => void calls.push(`dispatchEvent ${name}`),
  });
  boxes["link Settings.first()"] = boxes["link Settings"];
  const page = {
    viewportSize: () => ({ width: 1920, height: 1080 }),
    getByRole: (role: string, o: { name: string }) => locator(`${role} ${o.name}`),
    locator: (selector: string) => locator(selector),
    evaluate: async () => { calls.push("evaluate"); return 42; },
    mouse: {
      move: async (x: number, y: number) => void calls.push(`move ${Math.round(x)},${Math.round(y)}`),
      // `nestedScroller`: the wheel lands on an inner scroll area, so the page itself doesn't move.
      wheel: async (_dx: number, dy: number) => { if (!nestedScroller) scrollY += dy; calls.push(`wheel ${Math.round(dy)}`); },
    },
    keyboard: {
      type: async (text: string, o: { delay: number }) => void calls.push(`keyboard.type "${text}" ${o.delay}`),
      press: async (key: string) => void calls.push(`keyboard.press ${key}`),
    },
  };
  return { page: page as unknown as Page, calls };
}

let now = 0; // The fake clock; sleep() and the fake page's latency move it.
let nestedScroller = false;
const clock = { now: () => now };
const sleep = async (ms: number) => { now += ms; };

let events: RunnerEvent[];
let warnings: string[];
beforeEach(() => { now = 0; events = []; warnings = []; nestedScroller = false; });

const wrap = (page: Page) => wrapPage(page, { clock, events, sleep, warn: (m) => warnings.push(m) });

describe("wrapPage", () => {
  it("eases the mouse to a target's centre, then clicks it, and logs both", async () => {
    const { page, calls } = fakePage({ "link Settings": { x: 1400, y: 280, width: 24, height: 16 } });
    await wrap(page).getByRole("link", { name: "Settings" }).click();

    const moves = calls.filter((c) => c.startsWith("move"));
    expect(moves.length).toBeGreaterThan(5);
    expect(moves.at(-1)).toBe("move 1412,288");
    expect(calls.at(-1)).toBe("click link Settings");
    // Locating takes its 150 ms budget; the 517.5 px move lasts 394 ms, plus its 30 ms tail.
    expect(events).toEqual([
      { t: 150, type: "move", from: [960, 540], to: [1412, 288], durationMs: 394, easing: "easeInOutCubic" },
      { t: 574, type: "click", at: [1412, 288], button: "left", target: "link Settings",
        bounds: { x: 1400, y: 280, width: 24, height: 16 } },
    ]);
  });

  it("logs a click when Playwright's click returns, after its checks, not when it is called", async () => {
    const { page } = fakePage({ "link Settings": { x: 1400, y: 280, width: 24, height: 16 } }, 0, 90);
    await wrap(page).getByRole("link", { name: "Settings" }).click();
    expect(events.at(-1)).toMatchObject({ t: 664, type: "click" });
  });

  it("starts the next move where the last one ended", async () => {
    const { page } = fakePage({ "link A": { x: 90, y: 90, width: 20, height: 20 }, "link B": { x: 190, y: 90, width: 20, height: 20 } });
    const p = wrap(page);
    await p.getByRole("link", { name: "A" }).hover();
    await p.getByRole("link", { name: "B" }).hover();
    const moves = events.filter((e) => e.type === "move");
    expect(moves[1]).toMatchObject({ from: [100, 100], to: [200, 100] });
  });

  it("types visibly: clicks the field, clears it, then types 60 ms per character", async () => {
    const { page, calls } = fakePage({ "textbox Name": { x: 100, y: 100, width: 200, height: 30 } });
    await wrap(page).getByRole("textbox", { name: "Name" }).fill("hello");
    expect(calls.slice(-3)).toEqual([
      "click textbox Name",
      'fill textbox Name ""',
      'pressSequentially textbox Name "hello" 60',
    ]);
    expect(events.at(-1)).toMatchObject({ type: "type", text: "hello", charDelayMs: 60, target: "textbox Name",
      bounds: { x: 100, y: 100, width: 200, height: 30 } });
  });

  it("wraps chained locators too", async () => {
    const { page, calls } = fakePage({ "link Settings": { x: 1400, y: 280, width: 24, height: 16 } });
    await wrap(page).getByRole("link", { name: "Settings" }).first().click();
    expect(calls.at(-1)).toBe("click link Settings.first()");
    expect(events.map((e) => e.type)).toEqual(["move", "click"]);
  });

  it("scrolls an off-screen target into view with the wheel before moving to it", async () => {
    const { page, calls } = fakePage({ "button Save": { x: 900, y: 2500, width: 120, height: 40 } });
    await wrap(page).getByRole("button", { name: "Save" }).click();
    expect(calls.some((c) => c.startsWith("wheel"))).toBe(true);
    expect(events.map((e) => e.type)).toEqual(["scroll", "move", "click"]);
    expect(events[0]).toMatchObject({ delta: [0, 1980] });
    expect(calls.filter((c) => c.startsWith("move")).at(-1)).toBe("move 960,540");
    expect(events.at(-1)).toMatchObject({ bounds: { x: 900, y: 520, width: 120, height: 40 } });
  });

  it("keeps pre-action bounds when a navigating click removes its target", async () => {
    const { page } = fakePage({ "link Next": { x: 200, y: 100, width: 80, height: 20 } }, 0, 0, true);
    await wrap(page).getByRole("link", { name: "Next" }).click();
    expect(events.at(-1)).toMatchObject({ type: "click", bounds: { x: 200, y: 100, width: 80, height: 20 } });
  });

  it("eases page-level actions too, through the selector's locator", async () => {
    const { page, calls } = fakePage({ "#save": { x: 1400, y: 280, width: 24, height: 16 } });
    await wrap(page).click("#save");
    expect(calls.at(-1)).toBe("click #save");
    expect(events.map((e) => e.type)).toEqual(["move", "click"]);
    expect(warnings).toEqual([]);
  });

  it("logs page.mouse.wheel calls as scrolls", async () => {
    const { page } = fakePage({});
    await wrap(page).mouse.wheel(0, 600);
    expect(events).toEqual([{ t: 0, type: "scroll", delta: [0, 600], durationMs: expect.any(Number) }]);
  });

  it("runs calls it doesn't cover unchanged, and warns once per method", async () => {
    const { page, calls } = fakePage({ "link Settings": { x: 0, y: 0, width: 1, height: 1 } });
    const p = wrap(page);
    expect(await p.evaluate(() => 1)).toBe(42);
    await p.evaluate(() => 1);
    await p.getByRole("link", { name: "Settings" }).dispatchEvent("click");
    expect(calls).toEqual(["evaluate", "evaluate", "dispatchEvent link Settings"]);
    expect(warnings).toEqual([
      "page.evaluate() runs without cursor motion",
      "locator.dispatchEvent() runs without cursor motion",
    ]);
    expect(events).toEqual([]);
  });

  it("moves to a click's position option and logs the button it pressed", async () => {
    const { page, calls } = fakePage({ "button Menu": { x: 100, y: 100, width: 200, height: 40 } });
    await wrap(page).getByRole("button", { name: "Menu" }).click({ button: "right", position: { x: 10, y: 5 } });
    expect(calls.at(-1)).toBe("click button Menu right");
    expect(events.at(-1)).toMatchObject({ type: "click", at: [110, 105], button: "right" });
  });

  it("logs both presses of a double-click at the same point", async () => {
    const { page, calls } = fakePage({ "cell A1": { x: 100, y: 100, width: 80, height: 20 } });
    await wrap(page).getByRole("cell", { name: "A1" }).dblclick();
    expect(calls.at(-1)).toBe("dblclick cell A1");
    expect(events.filter((e) => e.type === "click")).toHaveLength(2);
  });

  it("keeps fill's timeout for every call it makes", async () => {
    const { page, calls } = fakePage({ "textbox Name": { x: 100, y: 100, width: 200, height: 30 } });
    await wrap(page).getByRole("textbox", { name: "Name" }).fill("hi", { timeout: 5000 });
    expect(calls.slice(-3)).toEqual([
      "click textbox Name timeout=5000",
      'fill textbox Name "" timeout=5000',
      'pressSequentially textbox Name "hi" 60 timeout=5000',
    ]);
  });

  it("fills date-like inputs directly instead of typing into them, without a click", async () => {
    const { page, calls } = fakePage({ "textbox Due": { x: 100, y: 100, width: 200, height: 30 } }, 0, 0, false,
      { "textbox Due": "date" });
    await wrap(page).getByRole("textbox", { name: "Due" }).fill("2026-01-05");
    expect(calls.filter((c) => !c.startsWith("move"))).toEqual(['fill textbox Due "2026-01-05"']);
    expect(events.map((e) => e.type)).toEqual(["move"]);
  });

  it("types through page.keyboard at the readable speed and logs it", async () => {
    const { page, calls } = fakePage({});
    const p = wrap(page);
    await p.keyboard.type("Ada");
    await p.keyboard.press("Enter");
    expect(calls).toEqual(['keyboard.type "Ada" 60', "keyboard.press Enter"]);
    expect(events).toEqual([{ t: 0, type: "type", text: "Ada", charDelayMs: 60, target: "keyboard" }]);
    expect(warnings).toEqual(["page.keyboard.press() runs without cursor motion"]);
  });

  it("wraps the locators all() returns", async () => {
    const { page, calls } = fakePage({ "listitem >> nth=1": { x: 100, y: 300, width: 200, height: 20 } });
    const items = await wrap(page).locator("listitem").all();
    await items[1].click();
    expect(calls.at(-1)).toBe("click listitem >> nth=1");
    expect(events.map((e) => e.type)).toEqual(["move", "click"]);
  });

  it("warns for locator.press like page.press", async () => {
    const { page, calls } = fakePage({});
    await wrap(page).getByRole("textbox", { name: "Search" }).press("Enter");
    expect(calls).toEqual(["press textbox Search Enter"]);
    expect(warnings).toEqual(["locator.press() runs without cursor motion"]);
  });

  it("lets Playwright scroll the target in when the wheel scrolled a nested area instead of the page", async () => {
    nestedScroller = true;
    const { page, calls } = fakePage({ "button Save": { x: 900, y: 2500, width: 120, height: 40 } });
    await wrap(page).getByRole("button", { name: "Save" }).click();
    expect(calls).toContain("scrollIntoViewIfNeeded button Save");
    expect(events.at(-1)).toMatchObject({ type: "click", at: [960, 540] });
  });

  it("brings a horizontally off-screen target into view before moving to it", async () => {
    const { page, calls } = fakePage({ "button Next": { x: 3000, y: 500, width: 100, height: 40 } });
    await wrap(page).getByRole("button", { name: "Next" }).click();
    expect(calls.some((c) => c.startsWith("wheel"))).toBe(true);
    expect(calls).toContain("scrollIntoViewIfNeeded button Next");
    expect(events.at(-1)).toMatchObject({ type: "click", at: [960, 540] });
  });

  it("keeps events on the same times however long Playwright's round-trips take", async () => {
    const times = [];
    for (const latency of [10, 80]) {
      now = 0;
      events = [];
      const { page } = fakePage({
        "button Save": { x: 900, y: 2500, width: 120, height: 40 },
        "textbox Name": { x: 100, y: 100, width: 200, height: 30 },
      }, latency);
      const p = wrap(page);
      await p.getByRole("button", { name: "Save" }).click();
      await p.getByRole("textbox", { name: "Name" }).fill("Ada");
      times.push({ events: events.map((e) => e.t), end: now });
    }
    expect(times[1]).toEqual(times[0]);
  });
});

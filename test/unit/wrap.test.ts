import { beforeEach, describe, expect, it } from "vitest";
import type { Page } from "playwright";
import type { RunnerEvent } from "../../src/schema/events.ts";
import { wrapPage } from "../../src/runner/wrap.ts";

// A fake of the Playwright surface the wrapper touches: the page, its mouse and locators. Every call lands in `calls`.
interface Box { x: number; y: number; width: number; height: number }

function fakePage(boxes: Record<string, Box>, boxLatencyMs = 0, clickLatencyMs = 0) {
  const calls: string[] = [];
  let scrollY = 0;
  const locator = (name: string): Record<string, unknown> => ({
    toString: () => name,
    boundingBox: async () => {
      now += boxLatencyMs;
      const b = boxes[name];
      return b && { ...b, y: b.y - scrollY };
    },
    click: async () => { now += clickLatencyMs; calls.push(`click ${name}`); },
    hover: async () => void calls.push(`hover ${name}`),
    fill: async (v: string) => void calls.push(`fill ${name} "${v}"`),
    pressSequentially: async (v: string, o: { delay: number }) =>
      void calls.push(`pressSequentially ${name} "${v}" ${o.delay}`),
    first: () => locator(`${name}.first()`),
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
      wheel: async (_dx: number, dy: number) => { scrollY += dy; calls.push(`wheel ${Math.round(dy)}`); },
    },
  };
  return { page: page as unknown as Page, calls };
}

let now = 0; // The fake clock; sleep() and the fake page's latency move it.
const clock = { now: () => now };
const sleep = async (ms: number) => { now += ms; };

let events: RunnerEvent[];
let warnings: string[];
beforeEach(() => { now = 0; events = []; warnings = []; });

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
      { t: 574, type: "click", at: [1412, 288], button: "left", target: "link Settings" },
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
    expect(events.at(-1)).toMatchObject({ type: "type", text: "hello", charDelayMs: 60, target: "textbox Name" });
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

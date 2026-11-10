import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { trackNetwork } from "../../src/runner/network.ts";

// A page that only emits request events, at times scheduled on a fake clock that sleep() moves forward.
// Requests are fetches unless a test says otherwise; a finished or failed event settles the first open one.
const fetch = { resourceType: () => "fetch" };

function fakePage(schedule: [at: number, event: "request" | "requestfinished" | "requestfailed"][]) {
  const page = new EventEmitter();
  let now = 0;
  const sleep = async (ms: number) => {
    const until = now + ms;
    for (const [at, event] of schedule.filter(([at]) => at > now && at <= until)) {
      now = at;
      page.emit(event, fetch);
    }
    now = until;
  };
  return { page, clock: { now: () => now }, sleep };
}

describe("trackNetwork", () => {
  it("is idle at once when nothing is loading", async () => {
    const { page, clock, sleep } = fakePage([]);
    const network = trackNetwork(page as unknown as Page, { clock, sleep });
    expect(await network.idle()).toBe(true);
    expect(clock.now()).toBe(0);
  });

  it("waits for requests a step started, then 500 ms of quiet", async () => {
    const { page, clock, sleep } = fakePage([[300, "requestfinished"], [400, "request"], [900, "requestfailed"]]);
    const network = trackNetwork(page as unknown as Page, { clock, sleep });
    page.emit("request", fetch);
    expect(await network.idle()).toBe(true);
    expect(clock.now()).toBeGreaterThanOrEqual(1400);
    expect(clock.now()).toBeLessThan(1500);
  });

  it("gives up after 10 s of activity and says so", async () => {
    const { page, clock, sleep } = fakePage([]);
    const network = trackNetwork(page as unknown as Page, { clock, sleep });
    page.emit("request", fetch);
    expect(await network.idle()).toBe(false);
    expect(clock.now()).toBeGreaterThanOrEqual(10_000);
  });

  it("ignores server-sent event streams, which stay open for the life of the page", async () => {
    const { page, clock, sleep } = fakePage([]);
    const network = trackNetwork(page as unknown as Page, { clock, sleep });
    page.emit("request", { resourceType: () => "eventsource" });
    expect(await network.idle()).toBe(true);
    expect(clock.now()).toBe(0);
  });
});

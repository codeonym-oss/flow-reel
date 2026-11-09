// The network-idle wait before each step (story decision 009). Playwright's "networkidle" load state only covers the
// document's first load, so fetches a step starts in the same page are counted here instead.
import type { Page, Request } from "playwright";

const QUIET_MS = 500;
const TIMEOUT_MS = 10_000;
const POLL_MS = 50;

export interface NetworkOptions {
  clock?: { now(): number };
  sleep?: (ms: number) => Promise<void>;
}

export function trackNetwork(page: Page, options: NetworkOptions = {}) {
  const clock = options.clock ?? performance;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let inFlight = 0;
  let lastChange = -Infinity;
  // A server-sent event stream stays open for the life of the page, so it would never let the page go idle.
  const counted = (request: Request) => request.resourceType() !== "eventsource";
  page.on("request", (request) => {
    if (!counted(request)) return;
    inFlight++;
    lastChange = clock.now();
  });
  const settled = (request: Request) => {
    if (!counted(request)) return;
    inFlight = Math.max(0, inFlight - 1);
    lastChange = clock.now();
  };
  page.on("requestfinished", settled);
  page.on("requestfailed", settled);

  return {
    /** Resolves to true once nothing has loaded for 500 ms, or to false after 10 s of activity. */
    async idle(): Promise<boolean> {
      const deadline = clock.now() + TIMEOUT_MS;
      while (inFlight > 0 || clock.now() - lastChange < QUIET_MS) {
        if (clock.now() >= deadline) return false;
        await sleep(POLL_MS);
      }
      return true;
    },
  };
}

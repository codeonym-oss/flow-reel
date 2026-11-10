// Chromium, headed in kiosk mode on the virtual display, with the variance story decision 009 asks to remove taken
// out: fixed viewport and device scale, reduced motion, a fixed start time, a seeded Math.random.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BrowserContext, type Page, chromium } from "playwright";
import { DISPLAY, SCALE } from "./display.ts";

const START_TIME = new Date("2026-01-05T09:00:00Z");
const SEED = 0;

// A persistent context, because its first page is Chromium's startup window, the only one --kiosk applies to;
// newContext() would open an ordinary window with tabs and an address bar. With no viewport emulation the window,
// and so the viewport, is the whole display: the CSS viewport at device scale 4/3.
export async function launchBrowser(viewport: [number, number]): Promise<{ context: BrowserContext; page: Page }> {
  const [width, height] = viewport;
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "flow-reel-profile-")), {
    headless: false,
    env: { ...process.env, DISPLAY },
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: null,
    reducedMotion: "reduce",
    args: [
      "--kiosk", "--window-position=0,0", `--window-size=${width},${height}`, `--force-device-scale-factor=${SCALE}`,
      "--no-first-run", "--no-default-browser-check", "--disable-infobars", "--disable-features=Translate",
      ...(process.env.FLOW_REEL_HOST_MAP === "1" ? ["--host-resolver-rules=MAP localhost host.docker.internal"] : []),
    ],
  });
  await context.addInitScript((seed: number) => {
    // mulberry32: the same sequence on every run.
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, SEED);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.clock.install({ time: START_TIME });
  return { context, page };
}

// The card painter (GH-76 decisions 003 and 007): a headless Chromium draws each card or overlay page at the reel's
// size with its clock frozen (Playwright's clock fakes timers, `Date`, `performance` and `requestAnimationFrame`),
// seeks every CSS and Web animation to the frame's time, and screenshots it. Only what the request serves loads: the
// network is off.
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { chromium } from "playwright";
import type { CardPainter } from "../../composer/ports.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html", ".htm": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".otf": "font/otf",
};

export const chromiumPainter: CardPainter = {
  async open() {
    const browser = await chromium.launch({ headless: true });
    return {
      async paint(request) {
        const origin = new URL(request.url).origin;
        const context = await browser.newContext({ viewport: { width: request.viewport[0], height: request.viewport[1] },
          deviceScaleFactor: request.scale, reducedMotion: "no-preference", serviceWorkers: "block" });
        try {
          await context.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) return route.abort("blockedbyclient");
            if (url.href === request.url) return route.fulfill({ contentType: "text/html", body: request.html });
            const file = request.file(url.pathname);
            if (!file || !statSync(file, { throwIfNoEntry: false })?.isFile()) return route.fulfill({ status: 404, body: "" });
            return route.fulfill({ contentType: TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", body: readFileSync(file) });
          });
          const page = await context.newPage();
          await page.clock.install({ time: 0 });
          await page.clock.pauseAt(1000);
          await page.goto(request.url, { waitUntil: "load" });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
          });
          let now = 0;
          for (const [i, t] of request.times.entries()) {
            if (t > now) await page.clock.runFor(t - now);
            now = Math.max(now, t);
            // Each animation's time is how long since it appeared, on the frozen clock.
            await page.evaluate((now) => {
              for (const animation of document.getAnimations() as (Animation & { flowReelBorn?: number })[]) {
                animation.flowReelBorn ??= now;
                animation.pause();
                animation.currentTime = now - animation.flowReelBorn;
              }
            }, now);
            writeFileSync(request.frame(i), await page.screenshot({ type: "png", caret: "hide", omitBackground: Boolean(request.transparent) }));
          }
        } finally {
          await context.close();
        }
      },
      close: () => browser.close(),
    };
  },
};

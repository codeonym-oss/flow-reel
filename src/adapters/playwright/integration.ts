// The Playwright integration: loads a script, opens its app in Chromium on the composer's display, and replays the
// script body with a page that animates and logs what it does.
import type { Integration } from "../../composer/ports.ts";
import { launchBrowser } from "./browser.ts";
import { loadDemo } from "./load.ts";
import { trackNetwork } from "./network.ts";
import { wrapPage } from "./wrap.ts";

const MARK_ID = "__flow_reel_mark";

export const playwright: Integration = {
  async load(scriptPath) {
    const demo = await loadDemo(scriptPath);
    const { viewport, url } = demo.options;
    return {
      viewport,
      async open() {
        const { context, page } = await launchBrowser(viewport);
        try {
          await page.goto(url, { waitUntil: "networkidle" });
          const network = trackNetwork(page);
          await page.mouse.move(viewport[0] / 2, viewport[1] / 2);
          await page.locator("body").boundingBox(); // warms up the round-trip the first step would otherwise pay for
          return {
            idle: () => network.idle(),
            async showMarker(rgb) {
              await page.evaluate(([id, colour]) => {
                const mark = document.createElement("div");
                mark.id = id;
                mark.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:rgb(${colour})`;
                document.documentElement.append(mark);
              }, [MARK_ID, rgb.join(",")]);
            },
            async hideMarker() {
              await page.evaluate((id) => document.getElementById(id)?.remove(), MARK_ID);
            },
            async run({ clock, events, fps, step, sound }) {
              await demo.body({ page: wrapPage(page, { clock, events, fps, viewport }), step, sfx: sound });
            },
            close: () => context.close(),
          };
        } catch (error) {
          await context.close();
          throw error;
        }
      },
    };
  },
};

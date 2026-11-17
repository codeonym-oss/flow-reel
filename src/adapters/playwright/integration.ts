// The Playwright integration: loads a script, opens its app in Chromium on the composer's display, and replays the
// script body with a page that animates and logs what it does.
import type { Integration } from "../../composer/ports.ts";
import type { ScriptContext } from "../../index.ts";
import { launchBrowser } from "./browser.ts";
import { loadScript } from "./load.ts";
import { trackNetwork } from "./network.ts";
import { wrapScript } from "./wrap.ts";

const MARK_ID = "__flow_reel_mark";

export const playwright: Integration = {
  name: "playwright",
  async load(scriptPath) {
    const script = await loadScript(scriptPath);
    const { viewport, url, autoZoom } = script.options;
    return {
      viewport,
      autoZoom,
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
            async run(stage) {
              const { clock, events, fps, comment, sound, speedUp, skip, card } = stage;
              const { page: wrapped, flash, zoomIn, zoomOut } = wrapScript(page, { clock, events, fps, viewport, stage });
              // showFrame was retired in 0.5 (GH-76 decision 004): a script still calling it is told what replaced it.
              const showFrame = () => Promise.reject(new Error("showFrame() was replaced by card.image() in flow-reel 0.5: " +
                'await card.image("diagram.png", { frame: "none", ms: 3000 })'));
              await script.body({ page: wrapped, comment, sound, flash, zoomIn, zoomOut, speedUp, skip, showFrame,
                card: card as ScriptContext["card"] });
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

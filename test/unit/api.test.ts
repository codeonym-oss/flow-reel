import { describe, expect, it } from "vitest";
import type { Locator } from "playwright";
import { script, Sounds, type ScriptContext } from "../../src/index.ts";

describe("script", () => {
  it("returns the options, with the default viewport, and the body, without running it", () => {
    let ran = false;
    const body = async () => { ran = true; };
    const s = script({ url: "http://localhost:3000" }, body);
    expect(s.options).toEqual({ url: "http://localhost:3000", viewport: [1920, 1080], autoZoom: true });
    expect(s.body).toBe(body);
    expect(ran).toBe(false);
  });

  it("keeps a viewport given by the script", () => {
    expect(script({ url: "http://x", viewport: [1280, 720] }, async () => {}).options.viewport).toEqual([1280, 720]);
  });
});

describe("Sounds", () => {
  it("names the eight sounds by purpose", () => {
    expect(Sounds).toEqual({
      feedback: { SUCCESS: "success", ERROR: "error", NOTIFICATION: "notification" },
      navigation: { OPEN: "open", CLOSE: "close", BACK: "back" },
      controls: { TOGGLE: "toggle", SELECT: "select" },
    });
  });

  it("is the only way to name a sound, and comments take text", () => {
    const check = ({ comment, sound }: ScriptContext, locator: Locator) => {
      sound(Sounds.feedback.SUCCESS);
      locator.comment("Save.").sound(Sounds.navigation.OPEN).first().click();
      // @ts-expect-error a bare string is not a sound
      sound("success");
      // @ts-expect-error a comment is text
      comment(42);
      // @ts-expect-error a chained sound is one of the Sounds constants too
      locator.sound("nope");
    };
    expect(typeof check).toBe("function");
  });
});

describe("effect words (GH-32 decisions 001 and 002)", () => {
  it("take options objects, standalone and chained; showFrame is awaited", () => {
    const check = async ({ flash, showFrame, zoomIn, zoomOut }: ScriptContext, locator: Locator) => {
      flash();
      flash({ color: "#ff0000", ms: 100 });
      zoomIn({ scale: 1.5 });
      zoomOut({ ms: 400 });
      await showFrame("diagram.png", 3000, { fit: "cover", background: "#ffffff" });
      await locator.zoomIn().flash({ ms: 300 }).sound(Sounds.feedback.SUCCESS).zoomOut().click();
      // @ts-expect-error an unknown option
      flash({ colour: "#ffffff" });
      // @ts-expect-error fit is contain or cover
      await showFrame("a.png", 10, { fit: "stretch" });
      // @ts-expect-error showFrame needs a duration
      await showFrame("a.png");
    };
    expect(typeof check).toBe("function");
    expect(script({ url: "http://x", autoZoom: false }, async () => {}).options.autoZoom).toBe(false);
  });
});

describe("skip (GH-62)", () => {
  it("takes a function and an optional label, and is awaited", () => {
    const check = async ({ page, skip }: ScriptContext) => {
      await skip(() => page.waitForResponse(/build/));
      await skip(async () => {}, { label: "{duration} plus tard" });
      // @ts-expect-error label is text
      await skip(async () => {}, { label: 4 });
      // @ts-expect-error it wraps a function
      await skip();
    };
    expect(typeof check).toBe("function");
  });
});

describe("speedUp (GH-61)", () => {
  it("takes a factor and a function, and is awaited", () => {
    const check = async ({ page, speedUp }: ScriptContext) => {
      await speedUp(4, () => page.getByText("Done").waitFor());
      await speedUp(1.5, async () => {});
      // @ts-expect-error the factor is a number
      await speedUp("4", async () => {});
      // @ts-expect-error it wraps a function
      await speedUp(4);
    };
    expect(typeof check).toBe("function");
  });
});

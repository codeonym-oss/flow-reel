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
  it("take options objects, standalone and chained", () => {
    const check = async ({ flash, zoomIn, zoomOut }: ScriptContext, locator: Locator) => {
      flash();
      flash({ color: "#ff0000", ms: 100 });
      zoomIn({ scale: 1.5 });
      zoomOut({ ms: 400 });
      await locator.zoomIn().flash({ ms: 300 }).sound(Sounds.feedback.SUCCESS).zoomOut().click();
      // @ts-expect-error an unknown option
      flash({ colour: "#ffffff" });
    };
    expect(typeof check).toBe("function");
    expect(script({ url: "http://x", autoZoom: false }, async () => {}).options.autoZoom).toBe(false);
  });
});

describe("cards (GH-76 decision 001)", () => {
  it("are typed words on card, each awaited with its props and options", () => {
    const check = async ({ card }: ScriptContext) => {
      await card.intro({ kicker: "Orbit 2.4", title: "Saved views", layout: "center", ms: 4000, enter: "zoom", theme: "paper" });
      await card.chapter({ title: "Save a view" });
      await card.feature({ title: "Saved views", points: ["One click", "Shared"], image: "shots/app.png", imageSide: "left" });
      await card.image("shots/mobile.png", { title: "On your phone", frame: "phone", fit: "contain" });
      await card.image("diagram.png");
      await card.compare({ before: "a.png", after: "b.png", labels: ["2.3", "2.4"] });
      await card.outro({ title: "Try it", url: "orbit.dev", links: ["Docs"] });
      await card.custom("cards/pricing.html", { plan: "Team", seats: 5, tags: ["a"] }, { exit: "cut" });
      // @ts-expect-error a title is needed
      await card.intro({ kicker: "x" });
      // @ts-expect-error layout is left or center
      await card.intro({ title: "x", layout: "right" });
      // @ts-expect-error an unknown transition
      await card.chapter({ title: "x", enter: "spin" });
      // @ts-expect-error frame is browser, phone or none
      await card.image("a.png", { frame: "tablet" });
      // @ts-expect-error two labels
      await card.compare({ before: "a.png", after: "b.png", labels: ["only"] });
    };
    expect(typeof check).toBe("function");
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

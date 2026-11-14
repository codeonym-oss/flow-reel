import { describe, expect, it } from "vitest";
import type { Locator } from "playwright";
import { script, Sounds, type ScriptContext } from "../../src/index.ts";

describe("script", () => {
  it("returns the options, with the default viewport, and the body, without running it", () => {
    let ran = false;
    const body = async () => { ran = true; };
    const s = script({ url: "http://localhost:3000" }, body);
    expect(s.options).toEqual({ url: "http://localhost:3000", viewport: [1920, 1080] });
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

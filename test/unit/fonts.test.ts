import { expect, it } from "vitest";
import { advanceEm } from "../../src/composer/media/fonts.ts";

it("reads advance widths from the bundled fonts, so a card's line can be centred before it is drawn", () => {
  expect(advanceEm("NotoSans-Bold.ttf", "0")).toBe(0.572);
  expect(advanceEm("NotoSans-Bold.ttf", ".")).toBe(0.281);
  expect(advanceEm("NotoSansSymbols2-Regular.ttf", "▶")).toBe(0.799);
  expect(advanceEm("NotoSansSymbols2-Regular.ttf", "⏭")).toBeGreaterThan(0.5);
  expect(advanceEm("NotoSans-Bold.ttf", "38 s")).toBeCloseTo(2 * 0.572 + advanceEm("NotoSans-Bold.ttf", " s"));
  // A character the font lacks counts as its missing-glyph box, beyond the BMP too.
  expect(advanceEm("NotoSans-Bold.ttf", "😀")).toBe(advanceEm("NotoSans-Bold.ttf", "\u{e000}"));
});

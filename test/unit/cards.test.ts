import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBrandFiles, themeFor, validateBrand } from "../../src/composer/cards/brand.ts";
import { builtInBody } from "../../src/composer/cards/catalog.ts";
import { customPage, pageHead } from "../../src/composer/cards/page.ts";
import { cardRequest } from "../../src/composer/cards/words.ts";
import { fileFor } from "../../src/composer/media/cards.ts";
import { readConfig, validateConfig, writeConfig, resolveSettings } from "../../src/settings.ts";

const dir = mkdtempSync(join(tmpdir(), "flow-reel-cards-"));
mkdirSync(join(dir, "cards"));
writeFileSync(join(dir, "cards/pricing.html"), "<!doctype html><html><head><title>p</title></head><body><b data-prop=\"plan\">Plan</b></body></html>");
writeFileSync(join(dir, "logo.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
writeFileSync(join(dir, "Display.woff2"), "font");

describe("card words (GH-76 decisions 001 and 002)", () => {
  it("checks a built-in card's props and fills in the brand's look", () => {
    expect(cardRequest("intro", [{ kicker: "Orbit 2.4", title: "Saved views", ms: 4000 }], dir, { theme: "paper", exit: "wipe" })).toEqual({
      type: "card", card: "intro", props: { kicker: "Orbit 2.4", title: "Saved views" }, files: [], ms: 4000, enter: "fade", exit: "wipe", theme: "paper",
    });
    expect(cardRequest("chapter", [{ title: "Save a view", theme: "ember", enter: "cut" }], dir, {}))
      .toMatchObject({ props: { title: "Save a view" }, enter: "cut", exit: "fade", theme: "ember" });
    expect(cardRequest("outro", [{ title: "Try it", links: ["docs", "blog"] }], dir, {})).toMatchObject({ props: { title: "Try it", links: ["docs", "blog"] } });
  });

  it("names the word and the prop when a card is called wrong", () => {
    const call = (word: "intro" | "chapter" | "outro", ...args: unknown[]) => () => cardRequest(word, args, dir, {});
    expect(call("intro", { subtitle: "x" })).toThrow("card.intro() needs title");
    expect(call("intro", { title: "" })).toThrow('card.intro(): title must be non-empty text, got ""');
    expect(call("intro", { title: "x", tilte: "y" })).toThrow('card.intro(): unknown prop "tilte"; it takes kicker, title, subtitle, layout, ms, enter, exit, theme');
    expect(call("intro", { title: "x", layout: "right" })).toThrow('card.intro(): layout must be "left" or "center", got "right"');
    expect(call("intro", "Saved views")).toThrow('card.intro() takes an object, as in card.intro({ title: "…" })');
    expect(call("chapter", { title: "x" }, { ms: 1 })).toThrow("card.chapter() takes one object, with its props and options together");
    expect(call("outro", { title: "x", links: [] })).toThrow("card.outro(): links must be a list of 1 to 4 non-empty texts, got []");
    expect(call("intro", { title: "x", ms: 100 })).toThrow("card.intro(): ms must be a number of milliseconds from 500 to 60000, got 100");
    expect(call("intro", { title: "x", enter: "spin" })).toThrow('card.intro(): enter must be one of "fade", "slide", "wipe", "zoom", "blur", "iris", "cut", got "spin"');
    expect(call("intro", { title: "x", theme: "neon" })).toThrow('card.intro(): theme must be one of "ink", "paper", "ocean", "ember", got "neon"');
  });

  it("takes a custom card's page from the script's folder, with JSON props and options apart", () => {
    const request = cardRequest("custom", ["cards/pricing.html", { plan: "Team", seats: 5, tags: ["a"] }, { ms: 2500 }], dir, {});
    expect(request).toMatchObject({ card: "custom", props: { plan: "Team", seats: 5, tags: ["a"] }, ms: 2500, files: [{ path: "cards/pricing.html" }] });
    expect(request.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    const call = (...args: unknown[]) => () => cardRequest("custom", args, dir, {});
    expect(call("cards/missing.html")).toThrow("card.custom(): cards/missing.html doesn't exist");
    expect(call("../outside.html")).toThrow("card.custom(): ../outside.html is outside the script's folder");
    expect(call("logo.svg")).toThrow("card.custom(): logo.svg must be a HTML, HTM file");
    expect(call("cards/pricing.html", { when: new Date() })).toThrow("card.custom(): props.when must be text, a number");
    expect(call("cards/pricing.html", {}, { mss: 1 })).toThrow('card.custom(): unknown option "mss"; it takes ms, enter, exit, theme');
  });
});

describe("the brand (GH-76 decision 006)", () => {
  it("checks the brand block of flow-reel.json, naming each bad key", () => {
    expect(validateBrand({ theme: "ocean", accent: "#D6336C", logo: "logo.svg", fonts: { heading: "Display.woff2" }, enter: "zoom", exit: "fade" })).toEqual([]);
    expect(validateBrand({ theme: "neon", accent: "pink", logo: "logo.gif", fonts: { title: "x.woff2", body: "x.pdf" }, enter: "spin", colour: 1 })).toEqual([
      'brand: unknown key "colour"; it takes theme, accent, logo, fonts, enter, exit',
      'brand.theme must be one of "ink", "paper", "ocean", "ember"',
      "brand.accent must be a #rrggbb colour",
      "brand.logo must be the path of an SVG, PNG, JPEG or WebP image",
      'brand.enter must be one of "fade", "slide", "wipe", "zoom", "blur", "iris", "cut"',
      'brand.fonts: unknown key "title"; it takes heading, body',
      "brand.fonts.body must be the path of a WOFF2, WOFF, TTF or OTF font",
    ]);
    expect(validateConfig({ version: 1, brand: [] })).toEqual(["brand must be an object"]);
  });

  it("checks the brand's files exist in the script's folder", () => {
    expect(() => checkBrandFiles(dir, { logo: "logo.svg", fonts: { heading: "Display.woff2" } })).not.toThrow();
    expect(() => checkBrandFiles(dir, { logo: "brand/logo.svg" })).toThrow("brand.logo: brand/logo.svg doesn't exist");
  });

  it("puts the accent in the theme, with text on it that reads", () => {
    expect(themeFor("ink")).toMatchObject({ bg: "#0b0d12", accent: "#6e9bff" });
    expect(themeFor("paper", { accent: "#D6336C" })).toMatchObject({ accent: "#d6336c", onAccent: "#ffffff" });
    expect(themeFor("ink", { accent: "#FFE066" })).toMatchObject({ onAccent: "#0b0d12" });
  });

  it("keeps the brand when the settings are saved", () => {
    const folder = mkdtempSync(join(tmpdir(), "flow-reel-brand-"));
    writeFileSync(join(folder, "flow-reel.json"), JSON.stringify({ version: 1, brand: { theme: "ember" } }));
    writeConfig(folder, resolveSettings(readConfig(folder)));
    expect(JSON.parse(readFileSync(join(folder, "flow-reel.json"), "utf8")).brand).toEqual({ theme: "ember" });
  });
});

describe("card pages (GH-76 decision 003)", () => {
  const context = { theme: themeFor("ink"), props: { plan: "Team", note: "</script><b>" }, durationMs: 3000, fonts: {} };

  it("puts the theme, the atoms and window.flowReel in the head, with the props safe inside a script", () => {
    const head = pageHead(context);
    expect(head).toContain("--fr-accent:#6e9bff");
    expect(head).toContain("--fr-duration:3000ms");
    expect(head).toContain(".fr-title{");
    expect(head).toContain("window.flowReel=Object.freeze(");
    expect(head).not.toContain("</script><b>");
  });

  it("injects the head first in a custom page's head, or adds one", () => {
    const page = customPage(context, readFileSync(join(dir, "cards/pricing.html"), "utf8"));
    expect(page.indexOf("--fr-bg")).toBeGreaterThan(page.indexOf("<head>"));
    expect(page.indexOf("--fr-bg")).toBeLessThan(page.indexOf("<title>"));
    expect(customPage(context, "<!doctype html><p>hi</p>")).toMatch(/^<!doctype html><head><meta charset="utf-8">.*<\/head><p>hi<\/p>$/s);
  });

  it("draws built-in cards from their props, escaped", () => {
    const body = builtInBody("intro", { title: "A <b>bold</b> title", layout: "center" }, context);
    expect(body).toContain("A &lt;b&gt;bold&lt;/b&gt; title");
    expect(body).toContain("fr-center");
    expect(builtInBody("chapter", { title: "Save" }, { ...context, chapter: { number: 2, total: 3 } })).toContain("Chapter 02 <span class=\"fr-muted\">/ 03</span>");
    const skip = builtInBody("skip", { label: "{duration} skipped", style: "clock" }, { ...context, props: { durationMs: 38_000 } });
    expect(skip).toContain("38 s");
    expect(skip).toContain(">skipped<");
  });

  it("serves only the backdrop, the bundled fonts and the script's folder", () => {
    expect(fileFor("/fr/backdrop.png", "/w/before.png", dir)).toBe("/w/before.png");
    expect(fileFor("/fr/fonts/Inter.woff2", "", dir)).toMatch(/docker\/fonts\/Inter\.woff2$/);
    expect(fileFor("/fr/fonts/../x.woff2", "", dir)).toBeUndefined();
    expect(fileFor("/script/cards/pricing.html", "", dir)).toBe(join(dir, "cards/pricing.html"));
    expect(fileFor("/script/..%2F..%2Fetc%2Fpasswd", "", dir)).toBeUndefined();
    expect(fileFor("/elsewhere", "", dir)).toBeUndefined();
  });
});

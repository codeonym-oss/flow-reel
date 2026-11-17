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
mkdirSync(join(dir, "shots"));
for (const name of ["app.png", "old.png", "new.webp"]) writeFileSync(join(dir, "shots", name), name);

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

  it("checks the feature, image and compare cards, hashing each image they show", () => {
    const feature = cardRequest("feature", [{ title: "Saved views", points: ["One click", "Shared"], image: "shots/app.png", imageSide: "left" }], dir, {});
    expect(feature).toMatchObject({ card: "feature", props: { title: "Saved views", points: ["One click", "Shared"], image: "shots/app.png", imageSide: "left" } });
    expect(feature.files).toEqual([{ path: "shots/app.png", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }]);
    expect(cardRequest("image", ["./shots/app.png", { title: "On your phone", frame: "phone", ms: 2000 }], dir, {}))
      .toMatchObject({ card: "image", props: { image: "shots/app.png", title: "On your phone", frame: "phone" }, ms: 2000 });
    expect(cardRequest("image", ["shots/app.png"], dir, {})).toMatchObject({ props: { image: "shots/app.png" } });
    const compare = cardRequest("compare", [{ before: "shots/old.png", after: "shots/new.webp", labels: ["2.3", "2.4"] }], dir, {});
    expect(compare.files.map((f) => f.path)).toEqual(["shots/old.png", "shots/new.webp"]);
    const call = (word: "feature" | "image" | "compare", ...args: unknown[]) => () => cardRequest(word, args, dir, {});
    expect(call("feature", { title: "x", points: ["1", "2", "3", "4", "5", "6"] })).toThrow("card.feature(): points must be a list of 1 to 5 non-empty texts");
    expect(call("feature", { title: "x" })).toThrow("card.feature() needs points");
    expect(call("image", { title: "x" })).toThrow('card.image() takes the image\'s path first: card.image("shots/app.png", { title: "…" })');
    expect(call("image", "shots/app.png", "phone")).toThrow("card.image() takes its props and options as an object, after the path");
    expect(call("image", "shots/missing.png")).toThrow("card.image(): image: shots/missing.png doesn't exist");
    expect(call("image", "shots/app.png", { frame: "tablet" })).toThrow('card.image(): frame must be "browser" or "phone" or "none", got "tablet"');
    expect(call("compare", { before: "shots/old.png", after: "shots/new.webp", labels: ["only"] })).toThrow("card.compare(): labels must be a list of 2 non-empty texts");
    expect(call("compare", { before: "shots/old.png" })).toThrow("card.compare() needs after");
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
    const image = builtInBody("image", { image: "shots/my app.png", frame: "phone" }, context);
    expect(image).toContain('src="/script/shots/my%20app.png"');
    expect(image).toContain('class="phone"');
    expect(builtInBody("compare", { before: "a.png", after: "b.png" }, context)).toMatch(/>Before<.*>After</s);
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

describe("overlays (GH-76 decision 007)", () => {
  it("checks each overlay's words and options, and fills in the brand's theme", async () => {
    const { overlayRequest } = await import("../../src/composer/cards/overlays.ts");
    expect(overlayRequest("callout", "callout()", { text: "The chart" }, { detail: "It follows the filter" }, { theme: "ocean" }))
      .toEqual({ props: { text: "The chart", detail: "It follows the filter" }, ms: 1500, theme: "ocean" });
    expect(overlayRequest("lowerThird", "lowerThird()", {}, { title: "Saved views", ms: 3000, theme: "paper" }, {}))
      .toEqual({ props: { title: "Saved views" }, ms: 3000, theme: "paper" });
    expect(overlayRequest("highlight", "highlight()", {}, undefined, {})).toEqual({ props: {}, ms: 1500, theme: "ink" });
    const call = (kind: "callout" | "highlight" | "lowerThird", props: object, options?: unknown) => () =>
      overlayRequest(kind, `${kind}()`, props as Record<string, unknown>, options, {});
    expect(call("callout", { text: "" })).toThrow('callout() takes the words to show, as in callout("The chart follows the filter")');
    expect(call("callout", { text: "x" }, { detial: "y" })).toThrow('callout(): unknown option "detial"; it takes detail, ms, theme');
    expect(call("lowerThird", {}, { subtitle: "x" })).toThrow('lowerThird() needs a title, as in lowerThird({ title: "Saved views" })');
    expect(call("highlight", {}, { ms: 100 })).toThrow("highlight(): ms must be a number of milliseconds from 500 to 60000, got 100");
    expect(call("highlight", {}, "now")).toThrow("highlight() takes an options object");
  });

  it("puts the callout's bubble below its element, or above when there is more room there", async () => {
    const { overlayBody } = await import("../../src/composer/cards/overlays.ts");
    const below = overlayBody("callout", { text: "A <b>chart</b>" }, [1920, 1080], { x: 300, y: 100, width: 400, height: 200 });
    expect(below).toContain('class="bubble below"');
    expect(below).toContain("top:326px");
    expect(below).toContain("A &lt;b&gt;chart&lt;/b&gt;");
    expect(overlayBody("callout", { text: "x" }, [1920, 1080], { x: 300, y: 800, width: 400, height: 200 })).toContain('class="bubble above"');
    expect(overlayBody("highlight", {}, [1920, 1080], { x: 10, y: 10, width: 20, height: 20 })).not.toContain("class=\"bubble");
    expect(overlayBody("lowerThird", { title: "Saved views", subtitle: "New" }, [1920, 1080])).toMatch(/class="third".*Saved views.*New/s);
  });

  it("shows an overlay until the next action on the video's clock, holds included, and never over a card", async () => {
    const { planTimeline, retimeEvents } = await import("../../src/composer/timeline.ts");
    const overlay = { type: "overlay" as const, overlay: "callout" as const, props: { text: "x" }, ms: 1500, theme: "ink" as const };
    // A 3 s comment over a 1.5 s step: 1.7 s held at its end, which the callout lasts through.
    const plan = planTimeline([{ index: 0, comment: "Look.", startMs: 500, actionEndMs: 2000, endMs: 2000,
      audio: { file: "a.wav", durationMs: 3000, sha256: "a".repeat(64) } }], { fps: 30, frames: 300, cutMs: 0, cards: [{ t: 2500, ms: 1000 }] });
    const [held, cut] = retimeEvents([{ t: 500, ...overlay, durationMs: 1700 }, { t: 500, ...overlay, durationMs: 5000 }], plan);
    expect(held).toMatchObject({ t: 500, durationMs: 3400 }); // to 2.2 s, plus the 1.7 s held
    // One running past the card stops where the card starts.
    expect((cut as { durationMs: number }).durationMs).toBe(plan.cards[0].startMs - 500);
  });
});

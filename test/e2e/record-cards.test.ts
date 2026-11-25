import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type EventLog, validateEvents } from "../../src/composer/schema/events.ts";
import type { Transcript } from "../../src/composer/schema/transcript.ts";
import { verifyReel } from "../../src/reel.ts";
import { fakeVoice, startFixtureApp } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";
import { compose, makeProject } from "./project.ts";

// Cards in reels composed in the image, spoken by the fake voice (split from record.test.ts, GH-92).
const OUT = resolve("test/e2e/out/record");
let app: Awaited<ReturnType<typeof startFixtureApp>>;
let port: number;

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  prepareImage("cloud");
  app = await startFixtureApp();
  port = app.port;
}, 900_000);

afterAll(() => app?.close());

describe("cards in a composed reel (GH-77)", () => {
  const cardScript = (p: number) => `import { script } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540] }, async ({ page, comment, card }) => {
  comment("Saved views, new in Orbit.");
  await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" });
  await card.chapter({ title: "Name it", enter: "slide" });
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await card.custom("cards/hello.html", { name: "Ada" }, { ms: 1500, exit: "cut" });
  await card.chapter({ title: "Settings", theme: "paper" });
  await page.getByRole("link", { name: "Settings" }).click();
  await card.outro({ title: "Try it", url: "orbit.dev/views" });
});`;
  const composeCards = async (name: string, make = cardScript) => {
    const dir = join(OUT, name);
    const project = makeProject(dir, { "demo.reel.ts": make(port),
      "cards/hello.html": "<!doctype html><html><head><style>body{margin:0;background:#ffcc00}</style></head>" +
        "<body><h1 class=\"fr-title\" data-prop=\"name\">x</h1></body></html>" },
    { voice: fakeVoice(port).voice, brand: { theme: "ocean", accent: "#46D3C8" } });
    const { reel } = await compose(project);
    return { reel, events: JSON.parse(readFileSync(join(reel, "events.json"), "utf8")) as EventLog,
      transcript: JSON.parse(readFileSync(join(reel, "transcript.json"), "utf8")) as Transcript };
  };
  let first: Awaited<ReturnType<typeof composeCards>>;
  let second: Awaited<ReturnType<typeof composeCards>>;
  beforeAll(async () => {
    first = await composeCards("cards-a");
    second = await composeCards("cards-b");
  }, 1_200_000);

  it("logs each card with its props and the brand's look, in the order shown", () => {
    expect(validateEvents(first.events)).toEqual([]);
    expect(first.transcript.voice?.adapter).toMatch(/^openai:/);
    const cards = first.events.events.flatMap((e) => e.type === "card" ? [e] : []);
    expect(cards.map(({ card, theme, enter, exit }) => [card, theme, enter, exit])).toEqual([
      ["intro", "ocean", "fade", "fade"], ["chapter", "ocean", "slide", "fade"], ["custom", "ocean", "fade", "cut"],
      ["chapter", "paper", "fade", "fade"], ["outro", "ocean", "fade", "fade"]]);
    expect(cards[2]).toMatchObject({ props: { name: "Ada" }, ms: 1500, files: [{ path: "cards/hello.html" }] });
  });

  it("speaks the comment over the intro, and shows each card in the video", () => {
    const [step] = first.transcript.steps;
    expect(step.endMs - step.startMs).toBeGreaterThanOrEqual(step.audio!.durationMs);
    const cards = first.events.events.flatMap((e) => e.type === "card" ? [e] : []);
    const still = (ms: number) => execFileSync("ffmpeg", ["-v", "error", "-ss", String(ms / 1000), "-i", join(first.reel, "video.mp4"),
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 24 });
    const corner = (ms: number) => [...still(ms).subarray((530 * 960 + 950) * 3, (530 * 960 + 950) * 3 + 3)];
    // The intro in the ocean theme's background, the custom card's yellow, the paper chapter's off-white.
    expect(corner(cards[0].t + 1500)).toEqual([8, 34, 44].map((v) => expect.closeTo(v, -1.2)));
    const yellow = corner(cards[2].t + 750);
    expect(yellow[0]).toBeGreaterThan(220);
    expect(yellow[2]).toBeLessThan(60);
    expect(corner(cards[3].t + 1500).every((v) => v > 230)).toBe(true);
  });

  it("verifies, and a second compose matches it", () => {
    expect(verifyReel(first.reel)).toMatchObject({ errors: [], differences: [] });
    const result = spawnSync(process.execPath, ["dist/cli.js", "compare", first.reel, second.reel], { encoding: "utf8" });
    expect(result).toMatchObject({ status: 0, stdout: "Reels match (step starts and effects within 150 ms).\n" });
  });

  it("fails a script still calling showFrame, naming card.image (GH-76 decision 004)", async () => {
    await expect(composeCards("cards-show-frame", (p) => `import { script } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540] }, async ({ showFrame }) => {
  await showFrame("cards/hello.html", 1000);
});`)).rejects.toMatchObject({ stderr: expect.stringContaining("showFrame() was replaced by card.image() in flow-reel 0.5") });
  }, 300_000);
});

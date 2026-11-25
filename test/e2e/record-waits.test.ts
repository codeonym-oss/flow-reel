import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type EventLog, validateEvents } from "../../src/composer/schema/events.ts";
import type { Transcript } from "../../src/composer/schema/transcript.ts";
import { verifyReel } from "../../src/reel.ts";
import { fakeVoice, SLOW_MS, startFixtureApp } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";
import { compose, makeProject } from "./project.ts";

// speedUp and skip in reels composed in the image, spoken by the fake voice (split from record.test.ts, GH-92).
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

describe("speedUp in a composed reel (GH-61)", () => {
  const speedScript = (p: number, inside = "") => `import { script } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540] }, async ({ page, comment, speedUp }) => {
  comment("Ask for the slow reply.");
  await speedUp(4, async () => {
    ${inside}
    await page.evaluate(() => fetch("/slow").then((r) => r.text()));
  });
  await page.getByRole("link", { name: "Settings" }).click();
});`;
  const composeSpeed = async (name: string, inside?: string, make = speedScript) => {
    const dir = join(OUT, name);
    const { reel } = await compose(makeProject(dir, { "demo.reel.ts": make(port, inside) }, { voice: fakeVoice(port).voice }));
    return { reel, events: JSON.parse(readFileSync(join(reel, "events.json"), "utf8")) as EventLog,
      transcript: JSON.parse(readFileSync(join(reel, "transcript.json"), "utf8")) as Transcript };
  };
  let first: Awaited<ReturnType<typeof composeSpeed>>;
  let second: Awaited<ReturnType<typeof composeSpeed>>;
  beforeAll(async () => {
    first = await composeSpeed("speed-a");
    second = await composeSpeed("speed-b");
  }, 900_000);

  it("plays the 20 s wait in about 5 s, with the comment spoken whole", () => {
    expect(validateEvents(first.events)).toEqual([]);
    expect(first.transcript.voice?.adapter).toMatch(/^openai:/);
    const speed = first.events.events.find((e) => e.type === "speed")!;
    expect(speed).toMatchObject({ type: "speed", factor: 4 });
    if (speed.type !== "speed") throw new Error("no speed event");
    expect(speed.durationMs).toBeGreaterThan(SLOW_MS / 4 - 100);
    expect(speed.durationMs).toBeLessThan(SLOW_MS / 4 + 1000);
    expect(first.transcript.video.durationMs).toBeLessThan(SLOW_MS - 5000);
    const [step] = first.transcript.steps;
    expect(step.endMs - step.startMs).toBeGreaterThanOrEqual(step.audio!.durationMs);
  });

  it("shows the badge in the top-right corner while the stretch plays, and not after", () => {
    const speed = first.events.events.find((e) => e.type === "speed")!;
    if (speed.type !== "speed") throw new Error("no speed event");
    const raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(first.reel, "video.mp4"), "-vf", "scale=96:54,format=rgb24",
      "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
    const size = 96 * 54 * 3;
    const light = (frame: number) => raw[frame * size + (3 * 96 + 92) * 3];
    const mid = Math.round((speed.t + speed.durationMs / 2) * 30 / 1000);
    const after = Math.round((speed.t + speed.durationMs) * 30 / 1000) + 15;
    expect(light(mid)).toBeLessThan(light(after) - 60);
  });

  it("verifies, and a second compose matches it", () => {
    expect(verifyReel(first.reel)).toMatchObject({ errors: [], differences: [] });
    const result = spawnSync(process.execPath, ["dist/cli.js", "compare", first.reel, second.reel], { encoding: "utf8" });
    expect(result).toMatchObject({ status: 0, stdout: "Reels match (step starts and effects within 150 ms).\n" });
  });

  it("fails the compose with a clear error when a comment is used inside", async () => {
    await expect(composeSpeed("speed-comment", `comment("Too late.");`)).rejects
      .toMatchObject({ stderr: expect.stringContaining("comment() can't be used inside speedUp(); put it before or after") });
  }, 300_000);

  describe("skip (GH-62)", () => {
    const skipScript = (p: number, inside = "") => `import { script, Sounds } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540] }, async ({ page, comment, skip, sound }) => {
  comment("The reply takes a while; here it is.");
  await skip(async () => {
    ${inside}
    sound(Sounds.feedback.SUCCESS);
    await page.evaluate(() => fetch("/slow").then((r) => r.text()));
  }, { label: "{duration} plus tard" });
  await page.getByRole("link", { name: "Settings" }).click();
});`;
    let a: Awaited<ReturnType<typeof composeSpeed>>;
    let b: Awaited<ReturnType<typeof composeSpeed>>;
    beforeAll(async () => {
      a = await composeSpeed("skip-a", undefined, skipScript);
      b = await composeSpeed("skip-b", undefined, skipScript);
    }, 900_000);

    it("cuts the 20 s wait to a card, drops what happened inside, and speaks the comment whole", () => {
      expect(validateEvents(a.events)).toEqual([]);
      const cut = a.events.events.find((e) => e.type === "skip")!;
      if (cut.type !== "skip") throw new Error("no skip event");
      expect(cut.label).toBe("{duration} plus tard");
      expect(cut.durationMs).toBeGreaterThan(SLOW_MS - 100);
      expect(cut.durationMs).toBeLessThan(SLOW_MS + 1000);
      expect(a.events.events.some((e) => e.type === "sound")).toBe(false);
      expect(a.transcript.video.durationMs).toBeLessThan(SLOW_MS - 12_000);
      const [step] = a.transcript.steps;
      expect(step.endMs - step.startMs).toBeGreaterThanOrEqual(step.audio!.durationMs);
    });

    it("shows the card over the blurred, dimmed app, with the length cut in the middle (GH-76 decision 008)", () => {
      const cut = a.events.events.find((e) => e.type === "skip")!;
      const still = (ms: number) => execFileSync("ffmpeg", ["-v", "error", "-ss", String(ms / 1000), "-i", join(a.reel, "video.mp4"),
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 24 });
      const card = still(cut.t + 750), before = still(cut.t - 100);
      expect(card[500 * 960 + 50]).toBeLessThan(before[500 * 960 + 50] * 0.7);
      // The ink panel in the middle, dark, with the length cut written in light text on it.
      expect(card[200 * 960 + 400]).toBeLessThan(40);
      const band = card.subarray(230 * 960, 310 * 960);
      expect(band.filter((v) => v > 200).length).toBeGreaterThan(200);
    });

    it("verifies, and a second compose matches it", () => {
      expect(verifyReel(a.reel)).toMatchObject({ errors: [], differences: [] });
      const result = spawnSync(process.execPath, ["dist/cli.js", "compare", a.reel, b.reel], { encoding: "utf8" });
      expect(result).toMatchObject({ status: 0, stdout: "Reels match (step starts and effects within 150 ms).\n" });
    });

    it("fails the compose with a clear error when flash is used inside", async () => {
      await expect(composeSpeed("skip-flash", "flash();", (p, inside) => skipScript(p, inside).replace("sound })", "sound, flash })"))).rejects
        .toMatchObject({ stderr: expect.stringContaining("flash() can't be used inside skip(); put it before or after") });
    }, 300_000);
  });
});

import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type EventLog, validateEvents } from "../../src/composer/schema/events.ts";
import { planPolish } from "../../src/composer/polish.ts";
import { verifyReel } from "../../src/reel.ts";
import { startFixtureApp } from "./fixture-app.ts";
import { prepareImage } from "./image.ts";

// Effects and overlays in reels composed in the image, without comments (split from record.test.ts, GH-92).
const OUT = resolve("test/e2e/out/record");
let app: Awaited<ReturnType<typeof startFixtureApp>>;
let port: number;
let image: string;

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  image = prepareImage();
  app = await startFixtureApp();
  port = app.port;
}, 900_000);

afterAll(() => app?.close());

describe("effect words in a composed reel (GH-32)", () => {
  // Composed in the image, with a green image beside the script shown as a card; no comments, so no voice to wait for.
  const effectsScript = (p: number, autoZoom: boolean) => `import { script } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540], autoZoom: ${autoZoom} }, async ({ page, card, flash, zoomIn, zoomOut }) => {
  await card.image("img/green.png", { frame: "none", fit: "contain", ms: 1000, enter: "cut", exit: "cut" });
  await page.getByRole("button", { name: "Save" }).zoomIn({ scale: 1.5 }).flash({ color: "#ff0000" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  zoomOut();
  flash();
  await page.getByRole("link", { name: "Settings" }).click();
});`;
  const composeEffects = async (name: string, autoZoom = true) => {
    const dir = join(OUT, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "img"), { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=lime:s=480x540", "-frames:v", "1", join(dir, "img", "green.png")]);
    writeFileSync(join(dir, "demo.ts"), effectsScript(port, autoZoom));
    const container = `flow-reel-${name}-${randomUUID()}`;
    try {
      const { stderr } = await promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--shm-size=1g",
        "--network", "host", "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`, image,
        "compose", "/work/demo.ts"], { timeout: 180_000 });
      if (stderr) writeFileSync(join(dir, "record.log"), stderr);
    } finally {
      spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
    }
    return { dir, reel: join(dir, "demo.reel"), events: JSON.parse(readFileSync(join(dir, "demo.reel/events.json"), "utf8")) as EventLog };
  };
  let first: Awaited<ReturnType<typeof composeEffects>>;
  let second: Awaited<ReturnType<typeof composeEffects>>;
  beforeAll(async () => {
    first = await composeEffects("effects-a");
    second = await composeEffects("effects-b");
  }, 600_000);

  it("logs each effect and the card with the image's hash, in the order the script used them", () => {
    expect(validateEvents(first.events)).toEqual([]);
    expect(first.events.autoZoom).toBe(true);
    const effects = first.events.events.filter((e) => ["flash", "card", "zoom"].includes(e.type));
    expect(effects.map((e) => e.type === "zoom" ? `zoom ${e.zoom}` : e.type)).toEqual(["card", "zoom in", "flash", "zoom out", "flash"]);
    expect(effects[0]).toMatchObject({ card: "image", props: { image: "img/green.png", frame: "none", fit: "contain" }, ms: 1000,
      files: [{ path: "img/green.png", sha256: createHash("sha256").update(readFileSync(join(first.dir, "img", "green.png"))).digest("hex") }] });
    expect(effects[1]).toMatchObject({ scale: 1.5, ms: 650, bounds: expect.any(Object) });
    expect(effects[2]).toMatchObject({ color: "#ff0000" });
    const click = first.events.events.find((e) => e.type === "click")!;
    expect(Math.abs(effects[2].t - click.t)).toBeLessThan(1); // logged right after the click
    expect(effects[1].t).toBeLessThan(click.t);
  });

  it("shows the image card for its frames, uncovered, and flashes red at the click", () => {
    const raw = execFileSync("ffmpeg", ["-v", "error", "-i", join(first.reel, "video.mp4"), "-vf", "scale=96:54,format=rgb24",
      "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
    const size = 96 * 54 * 3;
    const at = (frame: number, x: number, y: number) => [...raw.subarray(frame * size + (y * 96 + x) * 3, frame * size + (y * 96 + x) * 3 + 3)];
    const [shown, , flash] = first.events.events.filter((e) => ["flash", "card", "zoom"].includes(e.type));
    const start = Math.round(shown.t * 30 / 1000);
    // The image lifts in over its first second, then holds until the card's last frame.
    expect(at(start, 48, 27)[1]).toBeLessThan(120);
    for (const f of [start + 22, start + 29]) {
      expect(at(f, 48, 27)[1]).toBeGreaterThan(200); // the green image in the middle
      expect(Math.max(...at(f, 1, 27))).toBeLessThan(40);  // the ink card around it
    }
    expect(at(start + 30, 48, 27)[1] > 200 && at(start + 30, 48, 27)[0] < 60).toBe(false);
    const red = Math.ceil(flash.t * 30 / 1000 - 1e-9);
    expect(at(red, 2, 2)[0]).toBeGreaterThan(200);
    expect(at(red, 2, 2)[1]).toBeLessThan(60);
  });

  it("verifies, and gives the same effects on a second compose, which compare checks", () => {
    expect(verifyReel(first.reel)).toMatchObject({ errors: [], differences: [] });
    const result = spawnSync(process.execPath, ["dist/cli.js", "compare", first.reel, second.reel], { encoding: "utf8" });
    expect(result).toMatchObject({ status: 0, stdout: "Reels match (step starts and effects within 150 ms).\n" });
  });

  it("records autoZoom: false and draws no automatic zoom then", async () => {
    const off = await composeEffects("effects-off", false);
    expect(off.events.autoZoom).toBe(false);
    // The Settings click after zoomOut would zoom automatically; with autoZoom off the picture stays full.
    const out = off.events.events.find((e) => e.type === "zoom" && e.zoom === "out")!;
    const click = off.events.events.findLast((e) => e.type === "click")!;
    expect(click.t).toBeGreaterThan(out.t);
    const plan = planPolish(off.events.events, { viewport: [960, 540], source: [1280, 720], fps: 30,
      frames: Math.ceil(click.t * 30 / 1000) + 90, autoZoom: off.events.autoZoom });
    for (let n = Math.ceil((out.t + 800) * 30 / 1000); n < plan.frames; n++) expect(plan.frame(n).zoom).toBe(1);
  }, 240_000);
});

describe("overlays in a composed reel (GH-79)", () => {
  // No comments, so no voice to wait for: each overlay shows for its ms, until the next action.
  const overlayScript = (p: number) => `import { script } from "flow-reel";
export default script({ url: "http://localhost:${p}/", viewport: [960, 540] }, async ({ page, lowerThird }) => {
  await lowerThird({ title: "Saved views", subtitle: "New in Orbit 2.4", ms: 2000 });
  await page.getByRole("textbox", { name: "Name" }).fill("Ada");
  await page.getByRole("textbox", { name: "Name" }).callout("Name the view", { detail: "Any name", ms: 2000 });
  await page.getByRole("link", { name: "Settings" }).highlight({ ms: 1000, theme: "paper" });
  await page.getByRole("link", { name: "Settings" }).click();
});`;
  let run: { dir: string; reel: string; events: EventLog };
  beforeAll(async () => {
    const dir = join(OUT, "overlays");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "demo.ts"), overlayScript(port));
    const container = `flow-reel-overlays-${randomUUID()}`;
    try {
      const { stderr } = await promisify(execFile)("docker", ["run", "--name", container, "--rm", "--init", "--shm-size=1g",
        "--network", "host", "--user", `${process.getuid!()}:${process.getgid!()}`, "-v", `${dir}:/work`, image,
        "compose", "/work/demo.ts"], { timeout: 300_000 });
      if (stderr) writeFileSync(join(dir, "record.log"), stderr);
    } finally {
      spawnSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 10_000 });
    }
    const reel = join(dir, "demo.reel");
    run = { dir, reel, events: JSON.parse(readFileSync(join(reel, "events.json"), "utf8")) };
  }, 600_000);

  it("logs each overlay with its words, its element and how long it showed", () => {
    expect(validateEvents(run.events)).toEqual([]);
    const overlays = run.events.events.flatMap((e) => e.type === "overlay" ? [e] : []);
    expect(overlays.map(({ overlay, props, theme }) => [overlay, props, theme])).toEqual([
      ["lowerThird", { title: "Saved views", subtitle: "New in Orbit 2.4" }, "ink"],
      ["callout", { text: "Name the view", detail: "Any name" }, "ink"], ["highlight", {}, "paper"]]);
    expect(overlays[0].bounds).toBeUndefined();
    expect(overlays[1].bounds).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    for (const o of overlays) expect(o.durationMs).toBeGreaterThanOrEqual(o.ms - 50);
  });

  it("draws the lower third at the bottom left and dims the app around a callout", () => {
    const [third, callout] = run.events.events.flatMap((e) => e.type === "overlay" ? [e] : []);
    const still = (ms: number) => execFileSync("ffmpeg", ["-v", "error", "-ss", String(ms / 1000), "-i", join(run.reel, "video.mp4"),
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 24 });
    // The lower third's ink panel over the fixture's light page.
    expect(still(third.t + 1000)[480 * 960 + 60]).toBeLessThan(60);
    expect(still(third.t + third.durationMs + 600)[480 * 960 + 60]).toBeGreaterThan(150);
    // Away from the element, the app is dimmed while the callout shows.
    expect(still(callout.t + 1000)[300 * 960 + 900]).toBeLessThan(still(callout.t - 300)[300 * 960 + 900] * 0.7);
  });
});

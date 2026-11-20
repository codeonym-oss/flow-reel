// Cards drawn by the painter and assembled with their transitions (GH-76 decisions 003 and 005), in the image.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { type Transition, themeFor } from "../../src/composer/cards/brand.ts";
import type { CardJob } from "../../src/composer/media/cards.ts";
import { renderCardsInImage } from "./image.ts";

const dir = resolve("test/e2e/out/cards");
const script = join(dir, "script");
const capture = join(dir, "capture.mp4");
const fps = 30;
const viewport: [number, number] = [480, 270];
const media = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const SIZE = 640 * 360 * 3;
/** A clip's frames, decoded to RGB. */
const rgb = (file: string) => execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
const count = (raw: Buffer) => raw.length / SIZE;
const pixel = (raw: Buffer, frame: number, x: number, y: number) => [...raw.subarray(frame * SIZE + (y * 640 + x) * 3, frame * SIZE + (y * 640 + x) * 3 + 3)];
/** Whether any pixel of the frame's rows `from` to `to` is near white. */
const white = (raw: Buffer, frame: number, from = 0, to = 360) => {
  for (let i = frame * SIZE + from * 640 * 3; i < frame * SIZE + to * 640 * 3; i += 3) if (raw[i] > 200 && raw[i + 1] > 200 && raw[i + 2] > 200) return true;
  return false;
};

beforeAll(() => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(script, "cards"), { recursive: true });
  // Red for frames 0-29, blue after: a card inserted before frame 30 goes from red to blue.
  media(["-f", "lavfi", "-i", "color=red:s=640x360:r=30:d=1", "-f", "lavfi", "-i", "color=blue:s=640x360:r=30:d=1",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", capture]);
  // Screenshots standing in for an app's: a test pattern, and a darker one for "before".
  mkdirSync(join(script, "shots"), { recursive: true });
  media(["-f", "lavfi", "-i", "testsrc2=s=1280x800", "-frames:v", "1", join(script, "shots/app.png")]);
  media(["-f", "lavfi", "-i", "testsrc2=s=1280x800,hue=s=0,eq=brightness=-0.2", "-frames:v", "1", join(script, "shots/old.png")]);
  media(["-f", "lavfi", "-i", "testsrc2=s=390x844", "-frames:v", "1", join(script, "shots/phone.png")]);
  writeFileSync(join(script, "cards/clock.html"), `<!doctype html><html><head><style>
body{margin:0;background:#000}#box{position:absolute;inset:0;background:#000}</style></head>
<body><div id="box"></div><h1 data-prop="title" style="position:relative;color:#fff">placeholder</h1>
<img src="https://example.com/tracker.png" alt=""><script>
fetch("https://example.com/beacon").catch(() => {});
// Green once 500 ms have passed on the card's clock, and the size of the props' list in the page's title.
setTimeout(() => { document.getElementById("box").style.background = "#00ff00"; }, 500);
document.title = String(window.flowReel.props.items.length);
</script></body></html>`);
  // Drawn on a timer, with no DOM change: a frame can't be reused from the one before.
  writeFileSync(join(script, "cards/canvas.html"), `<!doctype html><html><body style="margin:0">
<canvas id="c" width="480" height="270"></canvas><script>
const c = document.getElementById("c").getContext("2d");
let k = 0;
setInterval(() => { c.fillStyle = k++ % 2 ? "#ff0000" : "#0000ff"; c.fillRect(0, 0, 480, 270); }, 100);
</script></body></html>`);
});

const job = (id: string, kind: CardJob["kind"], props: Record<string, unknown>, more: Partial<CardJob> = {}): CardJob =>
  ({ id, kind, props, theme: themeFor("ink"), enter: "fade", exit: "fade", frames: 45, frame: 30, ...more });
const render = (jobs: CardJob[], work: string) => {
  mkdirSync(work, { recursive: true });
  return renderCardsInImage(jobs, { capture, work, scriptDir: script, viewport, fps, brand: {} });
};
const still = (clip: string, frame: number, file: string) => media(["-i", clip, "-vf", `select=eq(n\\,${frame})`, "-frames:v", "1", "-fps_mode", "passthrough", file]);
const frames = (clip: string) => Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", clip], { encoding: "utf8" }));

describe("built-in cards", () => {
  it("draws every card in the catalog, for the eye to check", async () => {
    const jobs = [
      job("intro", "intro", { kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" }, { frames: 60, enter: "cut", exit: "cut" }),
      job("intro-center", "intro", { kicker: "Orbit 2.4", title: "Saved views", layout: "center" }, { frames: 60, enter: "cut", exit: "cut", theme: themeFor("paper") }),
      job("chapter", "chapter", { title: "Save a view", subtitle: "Two clicks, and it's in the sidebar" }, { frames: 60, enter: "cut", exit: "cut", chapter: { number: 2, total: 3 }, theme: themeFor("ocean") }),
      job("outro", "outro", { title: "Try saved views", url: "orbit.dev/views", links: ["docs", "changelog"] }, { frames: 60, enter: "cut", exit: "cut", theme: themeFor("ember") }),
      job("feature", "feature", { kicker: "New", title: "Saved views", points: ["Save any filter", "Share with the team", "Pin to the sidebar"], image: "shots/app.png" }, { frames: 60, enter: "cut", exit: "cut" }),
      job("image-browser", "image", { image: "shots/app.png", title: "Your views, one click away", url: "orbit.dev/projects" }, { frames: 60, enter: "cut", exit: "cut", theme: themeFor("paper") }),
      job("image-phone", "image", { image: "shots/phone.png", kicker: "Mobile", title: "On your phone too", caption: "The same views, wherever you are", frame: "phone" }, { frames: 60, enter: "cut", exit: "cut" }),
      job("compare", "compare", { before: "shots/old.png", after: "shots/app.png", kicker: "Before and after", title: "Six filters, or one click", labels: ["2.3", "2.4"] }, { frames: 75, enter: "cut", exit: "cut" }),
      job("skip-clock", "skip", { label: "{duration} skipped", style: "clock", durationMs: 38_000 }, { frames: 60, enter: "cut", exit: "cut" }),
      job("skip-bar", "skip", { label: "{duration} skipped", style: "bar", durationMs: 112_000 }, { frames: 60, enter: "cut", exit: "cut", theme: themeFor("paper") }),
    ];
    const clips = await render(jobs, join(dir, "catalog"));
    for (const { id, frames: n } of jobs) {
      expect(frames(clips[id])).toBe(n);
      still(clips[id], n - 1, join(dir, `${id}.png`));
    }
    // The intro's background is the ink theme's, and its title is drawn in light text over it.
    const intro = rgb(clips.intro);
    expect(Math.max(...pixel(intro, 59, 20, 340))).toBeLessThan(40);
    expect(white(intro, 59)).toBe(true);
  });

  it("plays each transition from the app frame before into the card, and out to the app frame after", async () => {
    const names: Transition[] = ["fade", "slide", "wipe", "zoom", "blur", "iris", "cut"];
    const clips = await render(names.map((t) => job(t, "chapter", { title: "Chapter" }, { enter: t, exit: t, chapter: { number: 1, total: 1 } })), join(dir, "transitions"));
    for (const t of names) {
      const f = rgb(clips[t]);
      expect(count(f)).toBe(45);
      const middle = pixel(f, 22, 600, 30);
      expect(Math.max(...middle)).toBeLessThan(40); // the card, in the ink theme
      if (t === "cut") {
        expect(Math.max(...pixel(f, 0, 600, 30))).toBeLessThan(40);
        continue;
      }
      expect(pixel(f, 0, 600, 30)[0]).toBeGreaterThan(150); // still the red app frame
      expect(pixel(f, 44, 600, 30)[2]).toBeGreaterThan(150); // already the blue one
      still(clips[t], 6, join(dir, `transition-${t}.png`));
    }
  });
});

describe("custom cards", () => {
  it("runs the page's own script on the card's frozen clock, fills its props, and loads nothing from the network", async () => {
    const custom = job("custom", "custom", { title: "Hello", items: [1, 2, 3] }, { page: "cards/clock.html", enter: "cut", exit: "cut" });
    const clips = await render([custom], join(dir, "custom"));
    const f = rgb(clips.custom);
    // Black before 500 ms (frame 15) on the card's clock, green from then on.
    expect(Math.max(...pixel(f, 10, 600, 300))).toBeLessThan(20);
    expect(pixel(f, 20, 600, 300)[1]).toBeGreaterThan(200);
    // The title prop replaced the placeholder: white text near the top left.
    expect(white(f, 20, 0, 60)).toBe(true);
    still(clips.custom, 20, join(dir, "custom.png"));
  });

  it("draws the same frames every time (GH-76 decision 003)", async () => {
    const card = job("again", "custom", { title: "Hello", items: [] }, { page: "cards/clock.html" });
    const hash = async (work: string) => createHash("sha256").update(rgb((await render([card], work)).again)).digest("hex");
    expect(await hash(join(dir, "again-1"))).toBe(await hash(join(dir, "again-2")));
    const intro = job("intro-again", "intro", { title: "Saved views", kicker: "Orbit" });
    const introHash = async (work: string) => createHash("sha256").update(rgb((await render([intro], work))["intro-again"])).digest("hex");
    expect(await introHash(join(dir, "intro-1"))).toBe(await introHash(join(dir, "intro-2")));
  });

  it("draws the same frames when several composes paint at once", async () => {
    const intro = job("busy", "intro", { title: "Saved views", kicker: "Orbit" });
    const hash = async (work: string) => createHash("sha256").update(rgb((await render([intro], work)).busy)).digest("hex");
    const hashes = await Promise.all([1, 2, 3].map((i) => hash(join(dir, `busy-${i}`))));
    expect(new Set(hashes).size).toBe(1);
  });

  it("draws every frame of a canvas page, which changes with no DOM change", async () => {
    const canvas = job("canvas", "custom", {}, { page: "cards/canvas.html", enter: "cut", exit: "cut" });
    const f = rgb((await render([canvas], join(dir, "canvas"))).canvas);
    // Blue from 100 ms (frame 3) on the card's clock, then red and blue swap every 100 ms (3 frames).
    expect([4, 7, 10, 13].map((n) => pixel(f, n, 320, 180)[0] > 200)).toEqual([false, true, false, true]);
  });
});

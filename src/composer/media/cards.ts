// Draws cards (GH-76 decisions 003 and 005): the card painter draws each card's page frame by frame, on a frozen
// clock, with only the card's own files to load; FFmpeg then plays the transitions in and out against the app frames
// on either side, into one clip per card.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { type Brand, type Theme, TRANSITIONS, type Transition } from "../cards/brand.ts";
import { type BuiltInKind, builtInBody } from "../cards/catalog.ts";
import { FONTS_PATH, ORIGIN, type PageContext, SCRIPT_PATH, builtInPage, customPage, scriptUrl } from "../cards/page.ts";
import type { CardPainter } from "../ports.ts";
import { FONTS_DIR } from "./fonts.ts";
import { SCALE } from "./display.ts";
import { videoFrames } from "./render.ts";

/** One card to draw: what it shows, how it looks, and where it sits in the capture. */
export interface CardJob {
  /** Its id in the timeline: `card<i>` or `skip<i>`. */
  id: string;
  kind: BuiltInKind | "custom";
  props: Record<string, unknown>;
  /** A custom card's page, relative to the script's folder. */
  page?: string;
  theme: Theme;
  enter: Transition;
  exit: Transition;
  /** How many video frames it lasts, transitions included. */
  frames: number;
  /** The source frame it is inserted before: the app frame after it; the one before is `frame - 1`. */
  frame: number;
  chapter?: { number: number; total: number };
}

export interface CardRenderOptions {
  capture: string;
  /** Where the frames, stills and clips go. */
  work: string;
  scriptDir: string;
  viewport: [number, number];
  fps: number;
  brand: Brand;
  painter: CardPainter;
}

// FFmpeg's xfade transitions for each of ours, coming in and going out (GH-76 decision 005).
const XFADE: Record<Exclude<Transition, "cut">, [enter: string, exit: string]> = {
  fade: ["fade", "fade"], slide: ["slideleft", "slideleft"], wipe: ["wipeleft", "wipeleft"], zoom: ["zoomin", "zoomin"],
  blur: ["hblur", "hblur"], iris: ["circleopen", "circleclose"],
};


function ffmpeg(args: string[]) {
  execFileSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-v", "error", ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 << 20 });
}

/** Writes source frames `n` and on, `files.length` of them, as PNGs, in one decode. */
function stills(capture: string, n: number, files: string[]) {
  const dir = dirname(files[0]);
  ffmpeg(["-i", capture, "-vf", `select=between(n\\,${n}\\,${n + files.length - 1})`, "-fps_mode", "passthrough",
    "-frames:v", String(files.length), "-start_number", "0", join(dir, "still%d.png")]);
  files.forEach((file, i) => renameSync(join(dir, `still${i}.png`), file));
}

/** The length of a transition in frames, so that both fit in the card's frames. */
function transitionFrames(job: CardJob, fps: number): [enter: number, exit: number] {
  const [enter, exit] = [TRANSITIONS[job.enter], TRANSITIONS[job.exit]].map((ms) => Math.round(ms * fps / 1000));
  const room = Math.max(0, job.frames - 1);
  if (enter + exit <= room) return [enter, exit];
  const k = room / (enter + exit);
  return [Math.floor(enter * k), Math.floor(exit * k)];
}

/** Draws every card; returns each one's clip by id. */
export async function renderCards(jobs: readonly CardJob[], options: CardRenderOptions): Promise<Record<string, string>> {
  if (!jobs.length) return {};
  const { capture, work, scriptDir, viewport, fps, brand, painter } = options;
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "json", capture], { encoding: "utf8" })).streams[0];
  const sourceFrames = videoFrames(capture);
  const size: [number, number] = [probe.width, probe.height];
  const fonts = {
    ...(brand.fonts?.heading ? { heading: scriptUrl(brand.fonts.heading) } : {}),
    ...(brand.fonts?.body ? { body: scriptUrl(brand.fonts.body) } : {}),
  };
  const logo = brand.logo ? scriptUrl(brand.logo) : undefined;
  const canvas = await painter.open();
  const clips: Record<string, string> = {};
  try {
    for (const job of jobs) {
      const dir = join(work, job.id);
      mkdirSync(dir, { recursive: true });
      const before = join(dir, "before.png");
      const after = join(dir, "after.png");
      if (job.frame < sourceFrames) stills(capture, job.frame - 1, [before, after]);
      else {
        stills(capture, job.frame - 1, [before]);
        writeFileSync(after, readFileSync(before));
      }
      const durationMs = job.frames * 1000 / fps;
      const context: PageContext = { theme: job.theme, props: job.props, durationMs, fonts, ...(logo ? { logo } : {}) };
      const html = job.kind === "custom"
        ? customPage(context, readFileSync(join(scriptDir, job.page!), "utf8"))
        : builtInPage(context, builtInBody(job.kind, job.props, { ...context, ...(job.chapter ? { chapter: job.chapter } : {}) }));
      const url = job.kind === "custom" ? `${ORIGIN}${scriptUrl(job.page!)}` : `${ORIGIN}/card.html`;
      await canvas.paint({ url, html, file: (path) => fileFor(path, before, scriptDir), viewport, scale: SCALE,
        times: Array.from({ length: job.frames }, (_, i) => i * 1000 / fps), frame: (i) => join(dir, `${String(i).padStart(5, "0")}.png`) });
      clips[job.id] = join(work, `${job.id}.mp4`);
      assemble(job, dir, before, after, clips[job.id], fps, size);
      rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    await canvas.close();
  }
  return clips;
}

/**
 * The file a card page may load for a path on the card origin (GH-76 decision 003): the skip card's backdrop, a
 * bundled font, or a file inside the script's folder; nothing else.
 */
export function fileFor(pathname: string, backdrop: string, scriptDir: string): string | undefined {
  if (pathname === "/fr/backdrop.png") return backdrop;
  if (pathname.startsWith(FONTS_PATH)) {
    const name = pathname.slice(FONTS_PATH.length);
    return /^[A-Za-z]+\.woff2$/.test(name) ? join(FONTS_DIR, name) : undefined;
  }
  if (!pathname.startsWith(SCRIPT_PATH)) return undefined;
  let path: string;
  try { path = decodeURIComponent(pathname.slice(SCRIPT_PATH.length)); } catch { return undefined; }
  const file = resolve(scriptDir, path);
  const inside = relative(scriptDir, file);
  return inside && !inside.startsWith("..") && !isAbsolute(inside) ? file : undefined;
}

/** The card's frames with its transitions against the app frames before and after it, as one clip. */
function assemble(job: CardJob, dir: string, before: string, after: string, clip: string, fps: number, [w, h]: [number, number]) {
  const [enter, exit] = transitionFrames(job, fps);
  const norm = `scale=${w}:${h},fps=${fps},format=yuv420p,setsar=1,settb=1/${fps}`;
  const filters = [`[0:v]${norm},trim=end_frame=${job.frames},setpts=PTS-STARTPTS[c0]`];
  let last = "c0";
  if (job.enter !== "cut" && enter) {
    filters.push(`[1:v]${norm},trim=end_frame=${enter},setpts=PTS-STARTPTS[b]`);
    filters.push(`[b][${last}]xfade=transition=${XFADE[job.enter][0]}:duration=${enter / fps}:offset=0[c1]`);
    last = "c1";
  }
  if (job.exit !== "cut" && exit) {
    filters.push(`[2:v]${norm},trim=end_frame=${exit},setpts=PTS-STARTPTS[a]`);
    filters.push(`[${last}][a]xfade=transition=${XFADE[job.exit][1]}:duration=${exit / fps}:offset=${(job.frames - exit) / fps}[c2]`);
    last = "c2";
  }
  filters.push(`[${last}]trim=end_frame=${job.frames},setpts=PTS-STARTPTS[v]`);
  ffmpeg(["-framerate", String(fps), "-i", join(dir, "%05d.png"), "-loop", "1", "-framerate", String(fps), "-i", before,
    "-loop", "1", "-framerate", String(fps), "-i", after, "-filter_complex", filters.join(";"), "-map", "[v]",
    "-frames:v", String(job.frames), "-r", String(fps), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", clip]);
}

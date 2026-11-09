// The virtual display Chromium draws on and ffmpeg captures (GH-2 decisions 001 and 005).
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

export const DISPLAY = ":99";
/** The browser draws at device scale 4/3, so the screen is 2560×1440 for a 1920×1080 CSS viewport (decision 005). */
export const SCALE = 4 / 3;

export const screenFor = ([width, height]: [number, number]): [number, number] =>
  [Math.round(width * SCALE), Math.round(height * SCALE)];

export async function startDisplay(viewport: [number, number]): Promise<ChildProcess> {
  const [width, height] = screenFor(viewport);
  const xvfb = spawn("Xvfb", [DISPLAY, "-screen", "0", `${width}x${height}x24`, "-nolisten", "tcp"], {
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    if (spawnSync("xdpyinfo", ["-display", DISPLAY], { stdio: "ignore" }).status === 0) return xvfb;
    await sleep(100);
  }
  xvfb.kill();
  throw new Error(`Xvfb didn't start on ${DISPLAY}`);
}

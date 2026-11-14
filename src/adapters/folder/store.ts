// The cassette store as plain files (story decision 006 of GH-1): results beside the script, work files in
// .flow-reel/<name>/ next to it.
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { CassetteStore } from "../../composer/ports.ts";

const writeJson = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

export const folderStore: CassetteStore = {
  open(scriptPath) {
    const dir = dirname(scriptPath);
    const name = basename(scriptPath).replace(/\.[cm]?ts$/, "");
    const hidden = join(dir, ".flow-reel");
    const work = join(hidden, name);
    mkdirSync(work, { recursive: true });
    // Ignores the whole folder without touching the app's own .gitignore.
    if (!existsSync(join(hidden, ".gitignore"))) writeFileSync(join(hidden, ".gitignore"), "*\n");
    const stagedVideo = join(work, "delivery.mp4");
    const videoFile = `${name}.mp4`;
    return {
      work: {
        capture: join(work, "capture.mp4"), master: join(work, "master.mp4"), masterInfo: join(work, "master.json"),
        stagedVideo, voiceBus: join(work, "voice.wav"),
      },
      audioDir: join(dir, `${name}.audio`),
      audioRoot: dir,
      videoFile,
      commit({ transcript, events, captions }) {
        renameSync(stagedVideo, join(dir, videoFile));
        writeJson(join(dir, `${name}.transcript.json`), transcript);
        writeFileSync(join(dir, `${name}.srt`), captions.srt, "utf8");
        writeFileSync(join(dir, `${name}.vtt`), captions.vtt, "utf8");
        writeJson(join(dir, `${name}.events.json`), events);
      },
    };
  },
};

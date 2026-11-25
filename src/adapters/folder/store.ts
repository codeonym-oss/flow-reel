// The reel store as a local folder (GH-31 decisions 001, 002 and 005): built in `<name>.reel.partial/` and swapped in only
// once it is complete.
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReelStore } from "../../composer/ports.ts";
import type { Manifest } from "../../composer/schema/manifest.ts";
import { MANIFEST, hashFiles, listReelFiles } from "../../reel.ts";

const writeJson = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

export const folderStore: ReelStore = {
  open(reel) {
    const partial = `${reel}.partial`;
    const work = join(partial, "work");
    rmSync(partial, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    // The intermediates are large and only help debugging: keep them out of git without touching the app's .gitignore.
    writeFileSync(join(work, ".gitignore"), "*\n");
    const stagedVideo = join(work, "delivery.mp4");
    const videoFile = "video.mp4";
    return {
      work: {
        capture: join(work, "capture.mp4"), masterInfo: join(work, "master.json"),
        stagedVideo, voiceBus: join(work, "voice.wav"),
      },
      audioDir: join(partial, "audio"),
      audioRoot: partial,
      ...(existsSync(join(reel, "transcript.json")) ? { previous: reel } : {}),
      videoFile,
      commit({ transcript, events, captions, about }) {
        renameSync(stagedVideo, join(partial, videoFile));
        writeJson(join(partial, "transcript.json"), transcript);
        writeJson(join(partial, "events.json"), events);
        writeFileSync(join(partial, "captions.srt"), captions.srt, "utf8");
        writeFileSync(join(partial, "captions.vtt"), captions.vtt, "utf8");
        const manifest: Manifest = { version: 1, ...about, files: hashFiles(partial, listReelFiles(partial)) };
        writeJson(join(partial, MANIFEST), manifest);
        rmSync(reel, { recursive: true, force: true });
        renameSync(partial, reel);
      },
    };
  },
};

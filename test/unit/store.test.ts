import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { folderStore } from "../../src/adapters/folder/store.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-store-"));
  dirs.push(dir);
  return dir;
};
/** A finished reel whose video holds `video`. */
const built = (video: string) => {
  const dir = join(folder(), "reel");
  mkdirSync(join(dir, "audio"), { recursive: true });
  writeFileSync(join(dir, "video.mp4"), video);
  writeFileSync(join(dir, "audio/000.wav"), "clip");
  return dir;
};
const video = (reel: string) => readFileSync(join(reel, "video.mp4"), "utf8");

describe("publishing a reel to a folder", () => {
  it("puts the whole reel there, and nothing else beside it", async () => {
    const out = folder();
    const reel = join(out, "admin/refund.reel");
    await folderStore.publish(built("first"), reel);
    expect(readdirSync(join(out, "admin"))).toEqual(["refund.reel"]);
    expect(readdirSync(reel).sort()).toEqual(["audio", "video.mp4"]);
    expect(readFileSync(join(reel, "audio/000.wav"), "utf8")).toBe("clip");
  });

  it("replaces the old reel, whatever it held, and keeps the one it was given", async () => {
    const out = folder();
    const reel = join(out, "a.reel");
    await folderStore.publish(built("first"), reel);
    writeFileSync(join(reel, "stale.txt"), "");
    const second = built("second");
    await folderStore.publish(second, reel);
    expect(video(reel)).toBe("second");
    expect(existsSync(join(reel, "stale.txt"))).toBe(false);
    expect(readdirSync(out)).toEqual(["a.reel"]);
    writeFileSync(join(reel, "video.mp4"), "edited by hand");
    expect(video(second)).toBe("second");
  });

  it("leaves the old reel when the new one can't be read", async () => {
    const out = folder();
    const reel = join(out, "a.reel");
    await folderStore.publish(built("first"), reel);
    await expect(folderStore.publish(join(folder(), "missing"), reel)).rejects.toThrow(`${reel} can't be replaced: `);
    expect(video(reel)).toBe("first");
    expect(readdirSync(out)).toEqual(["a.reel"]);
  });

  it("finishes a replacement that was interrupted at any point", async () => {
    for (const interrupt of [
      (out: string) => { mkdirSync(join(out, ".a.reel.new")); writeFileSync(join(out, ".a.reel.new/video.mp4"), "half"); },
      (out: string) => { renameSync(join(out, "a.reel"), join(out, ".a.reel.old")); mkdirSync(join(out, ".a.reel.new")); },
      (out: string) => { mkdirSync(join(out, ".a.reel.old")); writeFileSync(join(out, ".a.reel.old/video.mp4"), "older"); },
    ]) {
      const out = folder();
      const reel = join(out, "a.reel");
      await folderStore.publish(built("first"), reel);
      interrupt(out);
      await folderStore.publish(built("second"), reel);
      expect(video(reel)).toBe("second");
      expect(readdirSync(out)).toEqual(["a.reel"]);
    }
  });

  it("gives the old reel back when the replacement was interrupted and can't be finished", async () => {
    const out = folder();
    const reel = join(out, "a.reel");
    await folderStore.publish(built("first"), reel);
    renameSync(reel, join(out, ".a.reel.old"));
    await expect(folderStore.publish(join(folder(), "missing"), reel)).rejects.toThrow("can't be replaced");
    expect(video(reel)).toBe("first");
  });
});

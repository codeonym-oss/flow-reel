import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EVEN_PAD, startRecording } from "../../src/runner/recorder.ts";

// A fake ffmpeg on PATH: it reports its first frame like x11grab, then behaves as `body` says.
const path = process.env.PATH;
afterEach(() => { process.env.PATH = path; });

function fakeFfmpeg(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "flow-reel-ffmpeg-"));
  const file = join(dir, "ffmpeg");
  writeFileSync(file, `#!/bin/sh\nprintf '%s\\n' "$@" > '${join(dir, "args")}'\n` +
    `echo "  Duration: N/A, start: 1700000000.000000, bitrate: N/A" >&2\n${body}\n`);
  chmodSync(file, 0o755);
  process.env.PATH = `${dir}:${path}`;
  return dir;
}

describe("startRecording", () => {
  it("pads an odd capture to even dimensions for libx264", async () => {
    const dir = fakeFfmpeg("cat > /dev/null; exit 0");
    const recording = await startRecording(join(dir, "out.mp4"), [853, 480]);
    await recording.stop();
    const args = readFileSync(join(dir, "args"), "utf8").split("\n");
    expect(args).toContain("853x480");
    expect(args[args.indexOf("-vf") + 1]).toBe(EVEN_PAD);
  });

  it("fails instead of hanging when the encoder dies after its first frame", async () => {
    const dir = fakeFfmpeg("echo 'width not divisible by 2' >&2; exit 1");
    const recording = await startRecording(join(dir, "out.mp4"), [853, 480]);
    await new Promise((r) => setTimeout(r, 300));
    await expect(recording.stop()).rejects.toThrow(/ffmpeg exited with 1[\s\S]*width not divisible by 2/);
  });

  it("fails clearly when the encoder exits before its first frame", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flow-reel-ffmpeg-"));
    writeFileSync(join(dir, "ffmpeg"), "#!/bin/sh\necho 'cannot open display' >&2\nexit 1\n");
    chmodSync(join(dir, "ffmpeg"), 0o755);
    process.env.PATH = `${dir}:${path}`;
    await expect(startRecording(join(dir, "out.mp4"), [854, 480])).rejects.toThrow(/before its first frame[\s\S]*cannot open display/);
  });
});

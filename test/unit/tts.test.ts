import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { voiceSteps, type TtsAdapter } from "../../src/runner/tts.ts";

// Python wave: mono PCM16, 8 kHz, sixteen silent samples (2 ms).
const WAV = Buffer.from("UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "flow reel tts "));
  dirs.push(dir);
  return dir;
};
afterEach(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const voice = { adapter: "fixture", voice: "test", seed: 0 };
const adapter: TtsAdapter = { voice, async synthesize(jobs) {
  jobs.forEach((job) => writeFileSync(job.file, WAV));
} };

it("writes normalized narration as a clip with measured metadata, preserving the original step", async () => {
  const texts: string[] = [];
  const adapter: TtsAdapter = {
    voice,
    async synthesize(jobs) {
      for (const job of jobs) {
        texts.push(job.text);
        writeFileSync(job.file, WAV);
      }
    },
  };
  const steps = [{ index: 0, narration: "  Open\r\n <b>保存</b> & &lt;.\t ", startMs: 5, actionEndMs: 5, endMs: 5 }];
  const original = structuredClone(steps);
  const dir = join(directory(), "demo.audio");
  const result = await voiceSteps(steps, dir, adapter);
  expect(texts).toEqual(["Open <b>保存</b> & &lt;."]);
  expect(result).toEqual({ voice, steps: [{ ...steps[0], audio: {
    file: "demo.audio/000.wav", durationMs: 2,
    sha256: "faf90dde7fd7a168c57cb3a4724584c233c2b297754169d85a5d7b4165ef82fd",
  } }] });
  expect(readFileSync(join(dir, "000.wav"))).toEqual(WAV);
  expect(steps).toEqual(original);
});

it("keeps blank and old steps without audio and does not need a worker for an all-blank demo", async () => {
  const steps = [
    { index: 0, narration: " \r\n\t", startMs: 0, actionEndMs: 2, endMs: 2 },
    { index: 1, startMs: 3, actionEndMs: 4, endMs: 4 },
  ];
  const result = await voiceSteps(steps, join(directory(), "blank.audio"), {
    voice, async synthesize() { throw new Error("worker should not be needed"); },
  });
  expect(result.voice).toEqual(voice);
  expect(result.steps).toEqual(steps);
  expect(result.steps.every((step) => step.audio === undefined)).toBe(true);
});

it("replaces only this demo's generated clips, retaining gaps, large indexes and unrelated files", async () => {
  const root = directory();
  const dir = join(root, "demo.audio");
  const other = join(root, "other.audio");
  mkdirSync(dir);
  mkdirSync(other);
  writeFileSync(join(dir, "notes.txt"), "keep");
  writeFileSync(join(other, "000.wav"), WAV);
  const step = (index: number, narration: string) => ({ index, narration, startMs: 0, actionEndMs: 1, endMs: 1 });
  await voiceSteps([step(0, "First."), step(1, "Second.")], dir, adapter);
  const result = await voiceSteps([step(0, ""), step(2, "Third."), step(1000, "Last.")], dir, adapter);
  expect(result.steps.map((s) => s.audio?.file)).toEqual([undefined, "demo.audio/002.wav", "demo.audio/1000.wav"]);
  expect(readdirSync(dir).sort()).toEqual(["002.wav", "1000.wav", "notes.txt"]);
  expect(readFileSync(join(other, "000.wav"))).toEqual(WAV);
  await voiceSteps([], dir, adapter);
  expect(readdirSync(dir)).toEqual(["notes.txt"]);
});

it("rejects invalid audio before replacing a previous successful clip set", async () => {
  const dir = join(directory(), "demo.audio");
  const steps = [{ index: 0, narration: "Speak.", startMs: 0, actionEndMs: 1, endMs: 1 }];
  await voiceSteps(steps, dir, adapter);
  await expect(voiceSteps(steps, dir, { voice, async synthesize(jobs) {
    jobs.forEach((job) => writeFileSync(job.file, "not a WAV"));
  } })).rejects.toThrow(/step 0.*audio/i);
  expect(readFileSync(join(dir, "000.wav"))).toEqual(WAV);
  expect(readdirSync(dir)).toEqual(["000.wav"]);
});

it("keeps prior clips and removes partial work when synthesis fails", async () => {
  const dir = join(directory(), "demo.audio");
  const steps = [{ index: 0, narration: "Speak.", startMs: 0, actionEndMs: 1, endMs: 1 }];
  await voiceSteps(steps, dir, adapter);
  await expect(voiceSteps(steps, dir, { voice, async synthesize(jobs) {
    writeFileSync(jobs[0].file, "partial");
    throw new Error("step 0: worker failed");
  } })).rejects.toThrow("step 0: worker failed");
  expect(readFileSync(join(dir, "000.wav"))).toEqual(WAV);
  expect(readdirSync(dir)).toEqual(["000.wav"]);
});

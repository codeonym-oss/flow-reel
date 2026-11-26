import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { listen, watchPictures } from "../../src/host/control.ts";
import { Screen, newestOnly } from "../../src/host/screen.ts";

describe("the screen", () => {
  it("tells the record container only while someone watches", () => {
    const screen = new Screen();
    const told: string[] = [];
    screen.attach((input) => told.push(input));
    expect(told).toEqual([]);
    const first = screen.watch(() => {});
    const second = screen.watch(() => {});
    first();
    expect(told).toEqual(["watch"]);
    second();
    second();
    expect(told).toEqual(["watch", "unwatch"]);
  });

  it("tells a container that starts while someone watches at once", () => {
    const screen = new Screen();
    screen.watch(() => {});
    const told: string[] = [];
    const detach = screen.attach((input) => told.push(input));
    expect(told).toEqual(["watch"]);
    detach();
    screen.watch(() => {});
    expect(told).toEqual(["watch"]);
  });

  it("passes pictures to every watcher", () => {
    const screen = new Screen();
    const got: string[][] = [[], []];
    const stops = got.map((list) => screen.watch((jpeg) => list.push(jpeg)));
    screen.picture("a");
    stops[0]!();
    screen.picture("b");
    expect(got).toEqual([["a"], ["a", "b"]]);
  });
});

describe("newest only", () => {
  it("keeps only the newest item while one is on its way", () => {
    const sending: { item: number; sent: () => void }[] = [];
    const send = newestOnly<number>((item, sent) => sending.push({ item, sent }));
    send(1); send(2); send(3); send(4);
    expect(sending.map(({ item }) => item)).toEqual([1]);
    sending[0]!.sent();
    expect(sending.map(({ item }) => item)).toEqual([1, 4]);
    sending[1]!.sent();
    send(5);
    expect(sending.map(({ item }) => item)).toEqual([1, 4, 5]);
  });
});

describe("the picture command", () => {
  it("carries the run's pictures until the watcher leaves", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "flow-reel-screen-")));
    const screen = new Screen();
    const told: string[] = [];
    screen.attach((input) => told.push(input));
    const control = await listen(dir, () => {}, screen);
    try {
      const stop = new AbortController();
      const got: string[] = [];
      const watching = watchPictures(dir, (jpeg) => got.push(jpeg.toString()), stop.signal);
      while (!told.length) await sleep(10);
      expect(told).toEqual(["watch"]);
      screen.picture(Buffer.from("one").toString("base64"));
      while (!got.length) await sleep(10);
      stop.abort();
      await watching;
      while (told.length < 2) await sleep(10);
      expect(got).toEqual(["one"]);
      expect(told).toEqual(["watch", "unwatch"]);
    } finally { control.close(); }
  });

  it("is refused by a run without a live picture", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "flow-reel-screen-")));
    const control = await listen(dir, () => {});
    try {
      await expect(watchPictures(dir, () => {}, new AbortController().signal)).rejects.toThrow("no live picture");
    } finally { control.close(); }
  });
});

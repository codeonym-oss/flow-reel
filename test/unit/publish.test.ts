import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openJournal } from "../../src/host/journal.ts";
import { takeLock } from "../../src/host/lock.ts";
import { publishReel } from "../../src/host/publish.ts";
import type { Run } from "../../src/host/run-folder.ts";
import { PHASES } from "../../src/run/phases.ts";
import { folder, project, startRun } from "./runs.ts";

function build(run: Run): string {
  mkdirSync(join(run.dir, "reel"));
  writeFileSync(join(run.dir, "reel/video.mp4"), `run ${run.number}`);
  return join(run.dir, "reel");
}

/** Brings a run to its publish phase, as its driver does before it publishes. */
function toPublishing(run: Run): void {
  const journal = openJournal(run.dir);
  for (const phase of PHASES) {
    journal.append({ type: "phase-started", phase });
    if (phase !== "publish") journal.append({ type: "phase-finished", phase });
  }
  journal.close();
}

it("puts each newer run's reel in its place, and keeps an older one's in its run", async () => {
  const [data, root] = [folder(), project()];
  const runs = [await startRun(data, root), await startRun(data, root), await startRun(data, root)];
  const reel = () => readFileSync(join(runs[0].request.reel, "video.mp4"), "utf8");
  toPublishing(runs[0]);
  expect(await publishReel(runs[0], build(runs[0]))).toEqual({ reel: runs[0].request.reel });
  expect(reel()).toBe("run 1");
  toPublishing(runs[2]);
  // The third has begun to publish, so the second can't any more, whichever comes first.
  toPublishing(runs[1]);
  expect(await publishReel(runs[1], build(runs[1]))).toEqual({ reel: join(runs[1].dir, "reel"), newer: 3 });
  expect(reel()).toBe("run 1");
  expect(await publishReel(runs[2], build(runs[2]))).toEqual({ reel: runs[2].request.reel });
  expect(reel()).toBe("run 3");
  expect(readFileSync(join(runs[1].dir, "reel/video.mp4"), "utf8")).toBe("run 2");
});

it("doesn't mind a newer run whose reel goes somewhere else, or that hasn't got to publishing", async () => {
  const [data, root] = [folder(), project()];
  const first = await startRun(data, root);
  const elsewhere = await startRun(data, root);
  writeFileSync(join(elsewhere.dir, "request.json"), JSON.stringify({ ...elsewhere.request, reel: join(root, "other/a.reel") }));
  toPublishing(elsewhere);
  const going = await startRun(data, root);
  const journal = openJournal(going.dir);
  journal.append({ type: "phase-started", phase: "record" });
  journal.close();
  toPublishing(first);
  expect(await publishReel(first, build(first))).toEqual({ reel: first.request.reel });
});

it("waits for another run that is publishing, and leaves when it is cancelled", async () => {
  const run = await startRun(folder());
  toPublishing(run);
  const file = join(run.dir, "../../publish.lock");
  const lock = takeLock(file)!;
  const cancelled = new AbortController();
  const waiting = publishReel(run, build(run), cancelled.signal);
  setTimeout(() => cancelled.abort(new Error("the run was cancelled")), 50);
  await expect(waiting).rejects.toThrow();
  lock.release();
  expect(await publishReel(run, join(run.dir, "reel"))).toEqual({ reel: run.request.reel });
});

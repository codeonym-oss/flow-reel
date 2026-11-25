// A run's process whose phases use no container: recording lasts until the folder holds a file called `go`.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ownRun } from "../../src/host/owner.ts";
import { makeResult } from "../../src/host/results.ts";
import { readRunIn } from "../../src/host/run-folder.ts";
import { RESULTS, type ResultPhase } from "../../src/run/phases.ts";

const run = readRunIn(process.argv[2])!;
writeFileSync(join(run.dir, "pid"), String(process.pid));
ownRun(run, {
  log: console.log,
  async phase(phase, { signal }) {
    if (phase === "record") while (!existsSync(join(run.dir, "go"))) {
      if (!existsSync(run.dir)) process.exit(); // its test is over
      await sleep(20, undefined, { signal });
    }
    if ((RESULTS as readonly string[]).includes(phase)) await makeResult(run.dir, phase as ResultPhase, async () => {});
  },
}, () => { process.send?.({ type: "started" }, () => process.disconnect?.()); })
  .then(() => process.exit(0), (error: Error) => { process.send?.({ type: "failed", message: error.message }, () => process.exit(1)); });

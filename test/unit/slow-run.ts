// A run's process whose phases use no container. Recording, or the phase named in the file `at`, lasts until the run's
// folder holds a file called `go`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ownRun } from "../../src/host/owner.ts";
import { isHeavy, takeTurn } from "../../src/host/queue.ts";
import { makeResult } from "../../src/host/results.ts";
import { trim } from "../../src/host/retention.ts";
import { readRunIn } from "../../src/host/run-folder.ts";
import { RESULTS, type ResultPhase } from "../../src/run/phases.ts";

const run = readRunIn(process.argv[2])!;
writeFileSync(join(run.dir, "pid"), String(process.pid));
ownRun(run, {
  log: console.log,
  turn: async (phase, behind, signal) => isHeavy(phase, run.request.settings) ? takeTurn(run.dir, behind, signal) : undefined,
  async phase(phase, { signal }) {
    const at = existsSync(join(run.dir, "at")) ? readFileSync(join(run.dir, "at"), "utf8") : "record";
    if (phase === at) while (!existsSync(join(run.dir, "go"))) {
      if (!existsSync(run.dir)) process.exit(); // its test is over
      await sleep(20, undefined, { signal });
    }
    if ((RESULTS as readonly string[]).includes(phase)) await makeResult(run.dir, phase as ResultPhase, async () => {});
  },
}, () => { process.send?.({ type: "started" }); })
  .then(() => trim(run)).then(() => process.exit(0), (error: Error) => { process.send?.({ type: "failed", message: error.message }, () => process.exit(1)); });

// A run's own process: `run-process <run's folder> <tools>`. It owns the run until it ends, then exits.
import { appendFileSync } from "node:fs";
import { runPhase } from "./compose.ts";
import { ownRun } from "./owner.ts";
import { isHeavy, takeTurn } from "./queue.ts";
import { logFile, readRunIn } from "./run-folder.ts";
import { Screen } from "./screen.ts";
import { trim } from "./retention.ts";
import type { StartMessage, Tools } from "./start.ts";

async function main([dir, tools]: string[]): Promise<void> {
  const run = readRunIn(dir);
  if (!run) throw new Error(`${dir} holds no run`);
  const { engine, image } = JSON.parse(tools) as Tools;
  const log = logFile(dir);
  const screen = new Screen();
  await ownRun(run, { phase: (phase, hooks) => runPhase(phase, { run, engine, image }, { ...hooks, screen }),
    turn: async (phase, behind, signal) => isHeavy(phase, run.request.settings) ? takeTurn(run.dir, behind, signal) : undefined,
    log: (line) => appendFileSync(log, `${line}\n`) }, () => { if (process.connected) process.send!({ type: "started" } satisfies StartMessage); }, screen);
  await trim(run);
}

main(process.argv.slice(2)).then(() => process.exit(0), (error: Error) => {
  console.error(error.stack ?? error.message);
  if (!process.connected) process.exit(1);
  process.send!({ type: "failed", message: error.message } satisfies StartMessage, () => process.exit(1));
});

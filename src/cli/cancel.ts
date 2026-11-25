import { sendCommand } from "../host/control.ts";
import { type Command, EXIT, parse } from "./command.ts";
import { isGoing, theRun } from "./runs.ts";
import { watchToEnd } from "./watch.ts";

export const cancel: Command = {
  summary: "end a run",
  usage: "flow-reel cancel <run or script> [--json]",
  async run(args) {
    const { positionals: [name], flags } = parse(args, { json: "switch" }, { min: 1, max: 1 });
    const { id, run, state } = theRun(name, isGoing, ({ id, state }) => `${id} isn't running: it is ${state.state}`);
    if (!state.cancelling) {
      try { await sendCommand(run.dir, "cancel"); }
      catch (error) { throw new Error(`${id} can't be cancelled: ${(error as Error).message}`, { cause: error }); }
    }
    const { state: end } = await watchToEnd(id, run, { silent: true, interrupt: "leaves" });
    if (flags.json) console.log(JSON.stringify({ run: id, state: end?.state }));
    else console.log(end?.state === "cancelled" ? `${id} is cancelled` : `${id} ended before it could be cancelled: it is ${end?.state}`);
    return end?.state === "cancelled" ? EXIT.ok : EXIT.failed;
  },
};

// Watching runs: `watch` shows one to its end, `wait` says nothing until then, and `compose` watches the one it started.
import { relative } from "node:path";
import { sendCommand } from "../host/control.ts";
import { follow } from "../host/owner.ts";
import { type Run, logFile } from "../host/run-folder.ts";
import { type RunState, isEnded, next } from "../run/machine.ts";
import { type Command, EXIT, parse } from "./command.ts";
import { jsonView, liveView, plainView, silentView } from "./progress.ts";
import { latestRun } from "./runs.ts";

const CODES: Record<"done" | "failed" | "stopped" | "cancelled", number> =
  { done: EXIT.ok, failed: EXIT.failed, stopped: EXIT.stopped, cancelled: EXIT.cancelled };

/** How a run ended, for a person. */
export function ending(id: string, run: Run, end: RunState): string {
  if (end.state === "done") return `composed ${relative(process.cwd(), end.reel!.path) || end.reel!.path}`;
  if (end.state === "cancelled") return `${id} is cancelled`;
  return `${id} ${end.state}: ${end.ended!.message}\nThe log is ${logFile(run.dir)}`;
}

interface Watching {
  json?: boolean;
  silent?: boolean;
  /** What Ctrl+C does: cancels the run, or leaves it running. */
  interrupt: "cancels" | "leaves";
}

/** Shows a run until it has ended; returns its state then, and the exit code that says it. */
export async function watchToEnd(id: string, run: Run, { json, silent, interrupt }: Watching): Promise<{ code: number; state?: RunState }> {
  const view = silent ? silentView : json ? jsonView(id) : process.stderr.isTTY ? liveView(process.stderr) : plainView();
  const leave = new AbortController();
  let asked = false;
  // The first interrupt asks the run to end and waits for it; another one leaves.
  const onSignal = () => {
    if (interrupt === "leaves" || asked) return leave.abort();
    asked = true;
    view.say("cancelling");
    sendCommand(run.dir, "cancel").catch((error: Error) => view.say(error.message));
  };
  process.on("SIGINT", onSignal).on("SIGTERM", onSignal);
  let state: RunState | undefined;
  try {
    for await (const entry of follow(run.dir, leave.signal)) {
      state = next(state, entry);
      view.show(entry);
    }
  } catch (error) {
    if (!leave.signal.aborted) throw error;
  } finally {
    view.end();
    process.off("SIGINT", onSignal).off("SIGTERM", onSignal);
  }
  if (!state || !isEnded(state)) {
    view.say(`${id} is still ${state?.state ?? "queued"}`);
    return { code: interrupt === "leaves" ? EXIT.ok : EXIT.cancelled, state };
  }
  view.say(ending(id, run, state));
  return { code: CODES[state.state as keyof typeof CODES], state };
}

export const watch: Command = {
  summary: "show a run until it ends",
  usage: "flow-reel watch <run or script> [--json]",
  async run(args) {
    const { positionals: [name], flags } = parse(args, { json: "switch" }, { min: 1, max: 1 });
    const { id, run } = latestRun(name);
    return (await watchToEnd(id, run, { json: flags.json, interrupt: "leaves" })).code;
  },
};

export const wait: Command = {
  summary: "wait until a run ends; the exit code says how",
  usage: "flow-reel wait <run or script> [--json]",
  async run(args) {
    const { positionals: [name], flags } = parse(args, { json: "switch" }, { min: 1, max: 1 });
    const { id, run } = latestRun(name);
    const { code, state } = await watchToEnd(id, run, { silent: true, interrupt: "leaves" });
    if (flags.json) console.log(JSON.stringify({ run: id, state: state?.state, ...(state?.ended ? { why: state.ended.message } : {}) }));
    return code;
  },
};

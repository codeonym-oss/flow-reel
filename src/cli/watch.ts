// Watching runs: `watch` shows one to its end, `wait` says nothing until then, and `compose` watches the one it started.
import { join, relative } from "node:path";
import { sendCommand } from "../host/control.ts";
import { slashes } from "../host/files.ts";
import { follow } from "../host/owner.ts";
import { whatNext } from "../host/resume.ts";
import { type Run, logFile } from "../host/run-folder.ts";
import { type RunState, isEnded, next } from "../run/machine.ts";
import { type Command, EXIT, parse } from "./command.ts";
import { jsonView, liveView, plainView, silentView } from "./progress.ts";
import { latestRun } from "./find.ts";

const CODES: Record<"done" | "failed" | "stopped" | "cancelled", number> =
  { done: EXIT.ok, failed: EXIT.failed, stopped: EXIT.stopped, cancelled: EXIT.cancelled };

const here = (path: string) => slashes(relative(process.cwd(), path)) || path;

/** The command that records a run's script again. */
export const composeAgain = ({ request: { workspace, scripts, script } }: Run): string =>
  `\`flow-reel compose ${here(join(workspace.root, scripts, script.path))}\``;

/** Says that a run goes on by itself. */
export function announce(id: string, run: Run, json?: boolean): number {
  const { script } = run.request;
  if (json) console.log(JSON.stringify({ run: id, script: script.name, state: "running" }));
  else console.log(`${id} is composing ${script.name}: \`flow-reel watch ${run.number}\` shows it, \`flow-reel cancel ${run.number}\` ends it`);
  return EXIT.ok;
}

/** How a run ended and what can be done, for a person. */
export async function ending(id: string, run: Run, end: RunState): Promise<string> {
  const { reel } = run.request;
  if (end.state === "done") {
    const { path, newer } = end.reel!;
    return newer === undefined ? `composed ${here(path)}` : `composed ${path}; ${here(reel)} is the reel of a newer run, ${newer}`;
  }
  if (end.state === "cancelled") return `${id} is cancelled`;
  const next = await whatNext(run, end);
  const advice = next && ("resume" in next ? `\`flow-reel resume ${run.number}\` goes on from its ${next.resume} phase`
    : `It can't go on (${next.lost}): ${composeAgain(run)} starts a new run`);
  return [`${id} ${end.state}: ${end.ended!.message}`, `The log is ${logFile(run.dir)}`, ...(advice ? [advice] : [])].join("\n");
}

interface Watching {
  json?: boolean;
  silent?: boolean;
  /** What Ctrl+C does: cancels the run, or leaves it running. */
  interrupt: "cancels" | "leaves";
  /** How many of its first entries were shown before. */
  skip?: number;
}

/** Shows a run until it has ended; returns its state then, and the exit code that says it. */
export async function watchToEnd(id: string, run: Run, { json, silent, interrupt, skip = 0 }: Watching): Promise<{ code: number; state?: RunState }> {
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
  let count = 0;
  try {
    for await (const entry of follow(run.dir, leave.signal)) {
      state = next(state, entry);
      if (++count > skip) view.show(entry);
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
  view.say(await ending(id, run, state));
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

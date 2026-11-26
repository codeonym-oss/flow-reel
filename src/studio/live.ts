// A watched run (GH-137): found by its id, followed through its journal, and its state as the run machine works it out
// (decision 001).
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { type KnownWorkspace, knownWorkspaces, localSlug } from "../host/data.ts";
import { journalReader } from "../host/journal.ts";
import { runState } from "../host/owner.ts";
import { whatNext } from "../host/resume.ts";
import { type Run, logFile, readRunIn } from "../host/run-folder.ts";
import { trackedRuns } from "../host/tracker.ts";
import type { Entry } from "../run/journal.ts";
import { type RunState, isEnded, next } from "../run/machine.ts";
import type { LiveRun, RunLog } from "./api.ts";
import { Refused } from "./workspaces.ts";

export interface FoundRun { id: string; known: KnownWorkspace; run: Run }

/** The run an id such as `shop/12` names; of two workspaces with that slug, the one whose run started last. */
export function findRun(data: string, id: string): FoundRun {
  const match = /^(.+)\/(\d+)$/.exec(id);
  if (!match) throw new Refused(400, `${id} isn't a run: a run is named like shop/12`);
  const [, slug, number] = match;
  const found = knownWorkspaces(data).filter((known) => localSlug(known) === slug)
    .flatMap((known) => trackedRuns(data, known.id).filter((run) => run.number === Number(number)).map((tracked) => ({ known, tracked })))
    .sort((a, b) => Date.parse(b.tracked.startedAt) - Date.parse(a.tracked.startedAt))[0];
  const run = found && readRunIn(found.tracked.dir);
  if (!found || !run) throw new Refused(404, `there is no run ${id} on this computer`);
  return { id, known: found.known, run };
}

/** What the page shows of a run in a state; once ended, whether it can go on. */
export async function liveRun({ id, known, run }: FoundRun, state: RunState, entries: readonly Entry[]): Promise<LiveRun> {
  const { request } = run;
  const ended = isEnded(state);
  const can = ended ? await whatNext(run, state) : undefined;
  const phase = state.phase ?? state.ended?.phase;
  return {
    id, workspace: known.id, script: request.script.name, path: request.script.path,
    startedAt: entries[0]?.at ?? new Date().toISOString(), ...(ended && entries.length ? { endedAt: entries.at(-1)!.at } : {}),
    state: state.state, ...(phase ? { phase } : {}), finished: [...state.finished],
    ...(state.waiting ? { waiting: state.waiting } : {}), cancelling: state.cancelling,
    ...(state.ended ? { why: state.ended.message } : {}), ...(state.reel ? { reel: state.reel.path } : {}),
    ...(can && "resume" in can ? { resume: can.resume } : {}), ...(can && "lost" in can ? { lost: can.lost } : {}),
    voice: request.settings.voice.adapter, flowReel: request.flowReel,
  };
}

const POLL_MS = 200;
/** How many polls without news before asking whether the run's process still lives. */
const QUIET_POLLS = 5;

/**
 * Follows a run's journal from its first entry until `signal` aborts, as `follow` does, and goes on after it ends: a
 * resumed run adds to it. `seen` is called with each batch of new entries and the state they lead to.
 */
export async function followRun(dir: string, seen: (entries: Entry[], state: RunState) => Promise<void> | void, signal: AbortSignal): Promise<void> {
  const read = journalReader(dir);
  let state: RunState | undefined;
  for (let quiet = 0; !signal.aborted; ) {
    const entries = read();
    if (entries.length) {
      state = entries.reduce<RunState | undefined>(next, state);
      quiet = 0;
      await seen(entries, state!);
    } else if (++quiet >= QUIET_POLLS && state && !isEnded(state)) {
      // A run whose process is gone is recorded as stopped; the next read sees it.
      runState(dir);
      quiet = 0;
    }
    await new Promise((done) => { const timer = setTimeout(done, POLL_MS); signal.addEventListener("abort", () => { clearTimeout(timer); done(undefined); }, { once: true }); });
  }
}

/** The longest end of a log the page is sent. */
export const LONGEST_LOG = 256 * 1024;

/** The end of what a run's script, browser and renderer printed, and how many bytes before it were left out. */
export function logTail(dir: string, longest = LONGEST_LOG): RunLog {
  const file = logFile(dir);
  if (!existsSync(file)) return { text: "", cut: 0 };
  const size = statSync(file).size;
  const from = Math.max(0, size - longest);
  const buffer = Buffer.alloc(size - from);
  const fd = openSync(file, "r");
  try { readSync(fd, buffer, 0, buffer.length, from); } finally { closeSync(fd); }
  // Not from the middle of a line, or of a character.
  const text = buffer.toString("utf8");
  const start = from ? text.indexOf("\n") + 1 : 0;
  return { text: text.slice(start), cut: from + Buffer.byteLength(text.slice(0, start)) };
}

// The runs on this computer: `runs` lists them, and `clean` removes what finished ones no longer need.
import { createInterface } from "node:readline/promises";
import { type KnownWorkspace, dataDir, knownWorkspaces } from "../host/data.ts";
import { cleanable, hasHeavyFiles } from "../host/retention.ts";
import { whatNext } from "../host/resume.ts";
import { type FoundRun, workspaceRuns } from "../host/runs.ts";
import { findWorkspace } from "../workspace/workspace.ts";
import { type Command, EXIT, UsageError, parse } from "./command.ts";

/** This workspace, or every one on this computer. */
function workspaces(data: string, all: true | undefined): KnownWorkspace[] {
  const known = knownWorkspaces(data);
  if (all) return known;
  const { id } = findWorkspace(process.cwd()).config.workspace;
  return known.filter((one) => one.id === id);
}

/** Columns as wide as their widest cell. */
function table(rows: string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()).join("\n");
}

const when = (at: string) => new Date(at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

async function describe({ id, run, state }: FoundRun) {
  const next = await whatNext(run, state);
  return { run: id, script: run.request.script.name, startedAt: run.request.startedAt, state: state.state,
    ...(state.phase ? { phase: state.phase } : {}), ...(state.waiting ? { waiting: state.waiting } : {}),
    ...(state.reel ? { reel: state.reel.path, ...(state.reel.newer === undefined ? {} : { newer: state.reel.newer }) } : {}),
    ...(state.ended ? { why: state.ended.message } : {}), ...next, files: hasHeavyFiles(run.dir) };
}

type Described = Awaited<ReturnType<typeof describe>>;

function doing({ state, phase, waiting }: Described): string {
  if (waiting) return `waiting${waiting.behind ? ` for ${waiting.behind}` : ""}`;
  return phase ? `${state} (${phase})` : state;
}

function canDo({ run, files, ...row }: Described): string {
  if ("resume" in row) return `\`flow-reel resume ${run}\` goes on from its ${row.resume} phase`;
  return [..."lost" in row ? [`can't go on: ${row.lost}`] : [], ...files ? [] : ["files removed"]].join("; ");
}

export const runs: Command = {
  summary: "list this workspace's runs",
  usage: "flow-reel runs [--all] [--json]",
  async run(args) {
    const { flags } = parse(args, { all: "switch", json: "switch" }, { min: 0, max: 0 });
    const data = dataDir();
    const found = workspaces(data, flags.all).flatMap((known) => [...workspaceRuns(data, known)]);
    const rows = await Promise.all(found.map(describe));
    rows.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    if (flags.json) for (const row of rows) console.log(JSON.stringify(row));
    else if (rows.length) console.log(table(rows.map((row) => [row.run, row.script, when(row.startedAt), doing(row), canDo(row)])));
    else console.error(flags.all ? "flow-reel: there are no runs" : "flow-reel: this workspace has no runs");
    return EXIT.ok;
  },
};

const size = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

export const clean: Command = {
  summary: "remove finished runs' recordings, clips and videos; their history stays",
  usage: "flow-reel clean [--all] [--yes] [--json]",
  async run(args) {
    const { flags } = parse(args, { all: "switch", yes: "switch", json: "switch" }, { min: 0, max: 0 });
    const data = dataDir();
    const going = await cleanable(data, workspaces(data, flags.all));
    const say = (text: string) => { if (!flags.json) console.log(text); };
    if (!going.length) { say("There is nothing to clean."); return EXIT.ok; }
    say(table(going.map(({ what, bytes }) => "run" in what ? [what.run, size(bytes)] : [what.leftover, "a run that never started"])));
    if (!flags.yes && !await agreed(`Remove the files of these ${going.length}? Their journals and logs stay. [y/N] `)) {
      say("Nothing was removed.");
      return EXIT.ok;
    }
    let freed = 0;
    for (const { what, bytes, remove } of going) {
      const removed = await remove();
      if (removed) freed += bytes;
      if (flags.json) console.log(JSON.stringify({ ...what, bytes, removed }));
      else if (!removed && "run" in what) console.log(`${what.run} is going on again: its files stay`);
    }
    say(`Removed ${size(freed)}.`);
    return EXIT.ok;
  },
};

async function agreed(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) throw new UsageError("--yes is needed to remove them without being asked");
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try { return /^y(es)?$/i.test((await terminal.question(question)).trim()); }
  finally { terminal.close(); }
}

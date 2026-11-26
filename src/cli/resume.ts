import { readJournal } from "../host/journal.ts";
import { resumeRun } from "../host/new-run.ts";
import { whatNext } from "../host/resume.ts";
import type { Run } from "../host/run-folder.ts";
import { type Command, EXIT, parse } from "./command.ts";
import { theRun } from "./find.ts";
import { announce, composeAgain, watchToEnd } from "./watch.ts";

export const resume: Command = {
  summary: "let a run that stopped or failed go on with what it has",
  usage: "flow-reel resume <run or script> [--detach] [--json]",
  async run(args) {
    const { positionals: [name], flags } = parse(args, { detach: "switch", json: "switch" }, { min: 1, max: 1 });
    const canGoOn = async (run: Run, state: Parameters<typeof whatNext>[1]) => {
      const next = await whatNext(run, state);
      return next !== undefined && "resume" in next;
    };
    const { id, run, state } = await theRun(name, ({ run, state }) => canGoOn(run, state), async ({ id, run, state }) => {
      const next = await whatNext(run, state);
      return next && "lost" in next ? `${id} can't go on (${next.lost}): ${composeAgain(run)} starts a new run` : `${id} is ${state.state}: it has nothing to go on with`;
    });
    const say = (message: string) => console.error(`flow-reel: ${message}`);
    const skip = readJournal(run.dir).length;
    await resumeRun(id, run, state, { say });
    if (flags.detach) return announce(id, run, flags.json);
    return (await watchToEnd(id, run, { json: flags.json, interrupt: "cancels", skip })).code;
  },
};

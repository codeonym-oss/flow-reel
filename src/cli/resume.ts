import { detectEngine, ensureImage, packageVersion, targetFor } from "../host/engine.ts";
import { readJournal } from "../host/journal.ts";
import { whatNext } from "../host/resume.ts";
import { type Run, scriptsHash } from "../host/run-folder.ts";
import { startProcess } from "../host/start.ts";
import { findWorkspace } from "../workspace/workspace.ts";
import { type Command, EXIT, parse } from "./command.ts";
import { theRun } from "./runs.ts";
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
    const { request } = run;
    const next = await whatNext(run, state);
    const missing = next && "resume" in next && next.resume === "voice" ? request.credentials.find((name) => !process.env[name]) : undefined;
    if (missing) throw new Error(`voice ${request.settings.voice.adapter} needs ${missing}: set it in the environment and resume again`);
    const say = (message: string) => console.error(`flow-reel: ${message}`);
    if (await changedSince(run)) say(`the scripts have changed since ${id} started: it goes on with the ones it started with`);
    const engine = detectEngine();
    const image = ensureImage(engine, packageVersion(), targetFor(request.settings.voice.adapter), say);
    const skip = readJournal(run.dir).length;
    await startProcess(run, { engine, image });
    if (flags.detach) return announce(id, run, flags.json);
    return (await watchToEnd(id, run, { json: flags.json, interrupt: "cancels", skip })).code;
  },
};

/** Whether the project's scripts aren't the ones the run works on; a project that isn't there any more says nothing. */
async function changedSince({ request }: Run): Promise<boolean> {
  try { return await scriptsHash(findWorkspace(request.workspace.root)) !== request.script.folder; }
  catch { return false; }
}

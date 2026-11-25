// The results of a run's phases, as folders (GH-108 decision 015): a phase works in `<phase>.tmp/`, and its result counts
// once the folder has its final name. `result.json` says what it was made from and what it holds, so a later phase, or a
// resumed run, can tell whether it still holds.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { INPUTS, type Phase, type ResultPhase } from "../run/phases.ts";
import { type FileEntry, describeFiles, listFiles, renameWhenFree, sha256 as hashFile, sha256Text, syncTree, writeDurable } from "./files.ts";

const RESULT_FILE = "result.json";

interface Result {
  version: 1;
  phase: ResultPhase;
  /** The hash of the request, and of each earlier result it read. */
  inputs: Record<string, string>;
  files: FileEntry[];
}

export const resultDir = (runDir: string, phase: ResultPhase): string => join(runDir, phase);

const hashOf = (file: string) => sha256Text(readFileSync(file, "utf8"));

function inputsOf(runDir: string, phase: Phase): Record<string, string> {
  return { request: hashOf(join(runDir, "request.json")),
    ...Object.fromEntries(INPUTS[phase].map((input) => [input, hashOf(join(resultDir(runDir, input), RESULT_FILE))])) };
}

/** Runs `work` in an empty folder and makes that folder the phase's result; a failure leaves no result. */
export async function makeResult(runDir: string, phase: ResultPhase, work: (dir: string) => Promise<void>): Promise<void> {
  const dir = `${resultDir(runDir, phase)}.tmp`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const inputs = inputsOf(runDir, phase);
  await work(dir);
  const result: Result = { version: 1, phase, inputs, files: await describeFiles(dir, listFiles(dir)) };
  writeDurable(join(dir, RESULT_FILE), `${JSON.stringify(result, null, 2)}\n`);
  syncTree(dir);
  rmSync(resultDir(runDir, phase), { recursive: true, force: true });
  await renameWhenFree(dir, resultDir(runDir, phase));
}

/**
 * Why a phase's result can't be used, or undefined when it can: its inputs and its files are still what it says. Checking
 * sizes is enough to tell a person; contents are checked before they are used.
 */
export async function resultProblem(runDir: string, phase: ResultPhase, check: "sizes" | "contents" = "contents"): Promise<string | undefined> {
  const dir = resultDir(runDir, phase);
  if (!existsSync(join(dir, RESULT_FILE))) return "it has no result";
  let result: Result;
  try { result = JSON.parse(readFileSync(join(dir, RESULT_FILE), "utf8")) as Result; }
  catch { return "its result can't be read"; }
  if (result.version !== 1) return "its result is from another version of flow-reel";
  for (const input of INPUTS[phase]) if (!existsSync(join(resultDir(runDir, input), RESULT_FILE))) return `it was made from a ${input} that is gone`;
  const inputs = inputsOf(runDir, phase);
  const changed = Object.keys(inputs).find((name) => inputs[name] !== result.inputs[name]);
  if (changed) return `it was made from another ${changed}`;
  for (const { path, bytes, sha256 } of result.files) {
    const size = statSync(join(dir, path), { throwIfNoEntry: false })?.size;
    if (size === undefined) return `${path} is missing`;
    if (size !== bytes || (check === "contents" && await hashFile(join(dir, path)) !== sha256)) return `${path} changed`;
  }
  return undefined;
}

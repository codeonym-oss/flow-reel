import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareEffects, compareTranscripts } from "../compare.ts";
import { type Command, EXIT, UsageError, parse } from "./command.ts";
import { checkReel } from "./verify.ts";

export const compare: Command = {
  summary: "compare two reels' steps, voice and effects",
  usage: "flow-reel compare <a.reel> <b.reel> [--json]",
  run(args) {
    const { positionals: [left, right], flags } = parse(args, { json: "switch" }, { min: 2, max: 2 });
    if ([left, right].some((arg) => arg.endsWith(".json"))) {
      throw new UsageError("compare takes two reel folders, e.g. demos/a.reel demos/b.reel");
    }
    const problems = [left, right].flatMap((dir) => { const { errors, differences } = checkReel(dir); return [...errors, ...differences]; });
    const report = (code: number, errors: string[], differences: string[]) => {
      if (flags.json) console.log(JSON.stringify({ left, right, matches: code === EXIT.ok, errors, differences }));
      else if (errors.length) console.error(errors.join("\n"));
      else console.log(differences.length ? differences.join("\n") : "Reels match (step starts and effects within 150 ms).");
      return code;
    };
    if (problems.length) return report(EXIT.usage, problems, []);
    const read = (dir: string, file: string): unknown => {
      try { return JSON.parse(readFileSync(join(dir, file), "utf8")); }
      catch (error) { throw new UsageError(`${dir}: ${(error as Error).message}`); }
    };
    const checks = ([["transcript.json", compareTranscripts], ["events.json", compareEffects]] as const)
      .map(([file, check]) => check(read(left, file), read(right, file)));
    const errors = checks.flatMap((c) => c.errors).map((error) => error.replace(/^left:/, `${left}:`).replace(/^right:/, `${right}:`));
    const differences = checks.flatMap((c) => c.differences);
    return report(errors.length ? EXIT.usage : differences.length ? EXIT.failed : EXIT.ok, errors, errors.length ? [] : differences);
  },
};

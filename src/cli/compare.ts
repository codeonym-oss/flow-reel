import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareEffects, compareTranscripts } from "../compare.ts";
import { type Command, EXIT, UsageError, parse } from "./command.ts";
import { checkReel } from "./verify.ts";

export const compare: Command = {
  summary: "compare two reels' steps, voice and effects",
  usage: "flow-reel compare <a.reel> <b.reel>",
  run(args) {
    const { positionals: [left, right] } = parse(args, {}, { min: 2, max: 2 });
    if ([left, right].some((arg) => arg.endsWith(".json"))) {
      throw new UsageError("compare takes two reel folders, e.g. demos/a.reel demos/b.reel");
    }
    const problems = [left, right].flatMap((dir) => { const { errors, differences } = checkReel(dir); return [...errors, ...differences]; });
    if (problems.length) { console.error(problems.join("\n")); return EXIT.usage; }
    const read = (dir: string, file: string): unknown => {
      try { return JSON.parse(readFileSync(join(dir, file), "utf8")); }
      catch (error) { throw new UsageError(`${dir}: ${(error as Error).message}`); }
    };
    const checks = ([["transcript.json", compareTranscripts], ["events.json", compareEffects]] as const)
      .map(([file, check]) => check(read(left, file), read(right, file)));
    const errors = checks.flatMap((c) => c.errors);
    const differences = checks.flatMap((c) => c.differences);
    if (errors.length) {
      for (const error of errors) console.error(error.replace(/^left:/, `${left}:`).replace(/^right:/, `${right}:`));
      return EXIT.usage;
    }
    if (differences.length) { console.log(differences.join("\n")); return EXIT.failed; }
    console.log("Reels match (step starts and effects within 150 ms).");
    return EXIT.ok;
  },
};

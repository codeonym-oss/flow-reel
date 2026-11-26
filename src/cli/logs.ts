import { existsSync, readFileSync } from "node:fs";
import { logFile } from "../host/run-folder.ts";
import { type Command, EXIT, parse } from "./command.ts";
import { latestRun } from "./find.ts";

export const logs: Command = {
  summary: "print what a run's script, browser and renderer printed",
  usage: "flow-reel logs <run or script> [--json]",
  run(args) {
    const { positionals: [name], flags } = parse(args, { json: "switch" }, { min: 1, max: 1 });
    const { id, run } = latestRun(name);
    const text = existsSync(logFile(run.dir)) ? readFileSync(logFile(run.dir), "utf8") : "";
    if (!flags.json) process.stdout.write(text);
    else for (const line of text.split("\n").filter(Boolean)) process.stdout.write(`${JSON.stringify({ run: id, line })}\n`);
    return EXIT.ok;
  },
};

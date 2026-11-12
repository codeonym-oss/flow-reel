#!/usr/bin/env node
// `flow-reel record <script>`: on the host it starts the container; inside it (FLOW_REEL_IN_CONTAINER=1) it records.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const USAGE = "usage: flow-reel record <script.ts> [--no-sfx] | flow-reel compare <a.json> <b.json>";

async function main(argv: string[]): Promise<number> {
  const [command] = argv;
  let script = argv[1];
  if (command === "compare") {
    if (argv.length !== 3) { console.error(USAGE); return 2; }
    const { compareTranscripts } = await import("./compare.ts");
    const read = (file: string): unknown => {
      try { return JSON.parse(readFileSync(file, "utf8")); }
      catch (error) { throw new Error(`${file}: ${(error as Error).message}`); }
    };
    try {
      const result = compareTranscripts(read(script), read(argv[2]));
      if (result.errors.length) {
        for (const error of result.errors) console.error(error.replace(/^left:/, `${script}:`).replace(/^right:/, `${argv[2]}:`));
        return 2;
      }
      if (result.differences.length) { console.log(result.differences.join("\n")); return 1; }
      console.log("Transcripts match (step starts within 150 ms; transcript data only).");
      return 0;
    } catch (error) { console.error(`flow-reel: ${(error as Error).message}`); return 2; }
  }
  const args = argv.slice(1);
  const positionals = args.filter((arg) => !arg.startsWith("-"));
  const flags = args.filter((arg) => arg.startsWith("-"));
  if (command !== "record" || positionals.length !== 1 || flags.length > 1 || flags.some((arg) => arg !== "--no-sfx")) {
    console.error(USAGE);
    return 2;
  }
  script = positionals[0];
  const options = { sfx: !flags.includes("--no-sfx") };
  if (process.env.FLOW_REEL_IN_CONTAINER === "1") {
    const { record } = await import("./runner/run.ts");
    await record(resolve(script), options);
    return 0;
  }
  const { launch } = await import("./host/launch.ts");
  return launch(script, options);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`flow-reel: ${e.message}`);
    process.exit(1);
  },
);

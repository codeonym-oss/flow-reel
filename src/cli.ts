#!/usr/bin/env node
// `flow-reel record <script>`: on the host it starts the container; inside it (FLOW_REEL_IN_CONTAINER=1) it records.
import { resolve } from "node:path";

const USAGE = "usage: flow-reel record <script.ts>";

async function main(argv: string[]): Promise<number> {
  const [command, script] = argv;
  if (command !== "record" || !script) {
    console.error(USAGE);
    return 2;
  }
  if (process.env.FLOW_REEL_IN_CONTAINER === "1") {
    const { record } = await import("./runner/run.ts");
    await record(resolve(script));
    return 0;
  }
  const { launch } = await import("./host/launch.ts");
  return launch(script);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`flow-reel: ${e.message}`);
    process.exit(1);
  },
);

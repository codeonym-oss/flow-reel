#!/usr/bin/env node
// The `flow-reel` command, on the host. Composing happens in the composer's container; `verify` and `compare` only read.
import { EXIT, UsageError } from "./cli/command.ts";
import { COMMANDS } from "./cli/commands.ts";

const USAGE = `usage: flow-reel <command>\n\n${Object.entries(COMMANDS)
  .map(([name, { summary }]) => `  ${name.padEnd(10)}${summary}`).join("\n")}\n\nflow-reel <command> --help shows a command's options.`;

const help = (arg: string | undefined) => arg === "--help" || arg === "-h";

async function main([name, ...args]: string[]): Promise<number> {
  if (help(name)) { console.log(USAGE); return EXIT.ok; }
  if (name === "record") { console.error("flow-reel: `record` is now `compose` (flow-reel 0.2)"); return EXIT.usage; }
  const command = Object.hasOwn(COMMANDS, name ?? "") ? COMMANDS[name] : undefined;
  if (!command) { console.error(USAGE); return EXIT.usage; }
  if (args.some(help)) { console.log(`usage: ${command.usage}`); return EXIT.ok; }
  try { return await command.run(args); }
  catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`flow-reel: ${error.message}\nusage: ${command.usage}`);
    return EXIT.usage;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`flow-reel: ${e.message}`);
    process.exit(EXIT.failed);
  },
);

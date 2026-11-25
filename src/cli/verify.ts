import { listReelFiles, verifyReel } from "../reel.ts";
import { type Command, EXIT, parse } from "./command.ts";

/** A reel's errors and differences, each prefixed with its path. */
export function checkReel(dir: string): { errors: string[]; differences: string[] } {
  const { errors, differences } = verifyReel(dir);
  return { errors: errors.map((e) => `${dir}: ${e}`), differences: differences.map((d) => `${dir}: ${d}`) };
}

export const verify: Command = {
  summary: "check a reel against its manifest",
  usage: "flow-reel verify <reel> [--json]",
  run(args) {
    const { positionals: [reel], flags } = parse(args, { json: "switch" }, { min: 1, max: 1 });
    const { errors, differences } = checkReel(reel);
    if (flags.json) {
      console.log(JSON.stringify({ reel, matches: !errors.length && !differences.length, errors, differences }));
      return errors.length ? EXIT.usage : differences.length ? EXIT.failed : EXIT.ok;
    }
    if (errors.length) { console.error(errors.join("\n")); return EXIT.usage; }
    if (differences.length) { console.log(differences.join("\n")); return EXIT.failed; }
    const count = listReelFiles(reel).length;
    console.log(`Reel matches its manifest (${count} file${count === 1 ? "" : "s"}).`);
    return EXIT.ok;
  },
};

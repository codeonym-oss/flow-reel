import { listReelFiles, verifyReel } from "../reel.ts";
import { type Command, EXIT, parse } from "./command.ts";

/** A reel's errors and differences, each prefixed with its path. */
export function checkReel(dir: string): { errors: string[]; differences: string[] } {
  const { errors, differences } = verifyReel(dir);
  return { errors: errors.map((e) => `${dir}: ${e}`), differences: differences.map((d) => `${dir}: ${d}`) };
}

export const verify: Command = {
  summary: "check a reel against its manifest",
  usage: "flow-reel verify <reel>",
  run(args) {
    const { positionals: [reel] } = parse(args, {}, { min: 1, max: 1 });
    const { errors, differences } = checkReel(reel);
    if (errors.length) { console.error(errors.join("\n")); return EXIT.usage; }
    if (differences.length) { console.log(differences.join("\n")); return EXIT.failed; }
    const count = listReelFiles(reel).length;
    console.log(`Reel matches its manifest (${count} file${count === 1 ? "" : "s"}).`);
    return EXIT.ok;
  },
};

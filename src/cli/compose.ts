import { appendFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runPhase } from "../host/compose.ts";
import { dataDir, rememberWorkspace } from "../host/data.ts";
import { detectEngine, ensureImage, packageVersion, targetFor } from "../host/engine.ts";
import { createRun } from "../host/run-folder.ts";
import { PHASES } from "../run/phases.ts";
import { credentialsFor, resolveSettings } from "../settings.ts";
import { CONFIG_FILE, withSettings, writeConfig } from "../workspace/config.ts";
import { findScript, reelFolder } from "../workspace/workspace.ts";
import { type Command, EXIT, parse } from "./command.ts";

export const compose: Command = {
  summary: "compose a script into a reel",
  usage: "flow-reel compose <script.reel.ts> [--out <dir>] [--no-sound] [--integration <name>] [--voice <name>] " +
    "[--speaker <name>] [--language <name>] [--model <id>] [--api-key-env <variable>] [--base-url <url>] [--save-config]",
  async run(args) {
    const { positionals: [path], flags } = parse(args, { out: "text", "no-sound": "switch", integration: "text", voice: "text",
      speaker: "text", language: "text", model: "text", "api-key-env": "text", "base-url": "text", "save-config": "switch" }, { min: 1, max: 1 });
    const { workspace, script } = findScript(path);
    const data = dataDir();
    rememberWorkspace(data, workspace);
    const settings = resolveSettings(workspace.config, { integration: flags.integration, voice: flags.voice,
      speaker: flags.speaker, language: flags.language, model: flags.model, apiKeyEnv: flags["api-key-env"], baseUrl: flags["base-url"] });
    const credentials = credentialsFor(settings, process.env);
    const version = packageVersion();
    const say = (message: string) => console.error(`flow-reel: ${message}`);
    const engine = detectEngine();
    const image = ensureImage(engine, version, targetFor(settings.voice.adapter), say);
    const reel = reelFolder(workspace, script, flags.out);
    const run = await createRun(data, { workspace, script, settings, sound: !flags["no-sound"], reel, credentials, flowReel: version });
    const log = join(run.dir, "log.txt");
    try {
      for (const phase of PHASES) {
        await runPhase(phase, { run, engine, image, log: (line) => appendFileSync(log, `${line}\n`), report(progress) {
          if (progress.type === "voiced" && progress.spoken + progress.reused) {
            say(`voiced ${progress.spoken} of ${progress.spoken + progress.reused} comments (${progress.reused} reused)`);
          }
        } });
      }
    } catch (error) { throw new Error(`${(error as Error).message}\nThe log is ${log}`, { cause: error }); }
    say(`composed ${relative(process.cwd(), reel) || reel}`);
    if (flags["save-config"]) {
      writeConfig(workspace.root, withSettings(workspace.config, settings));
      say(`saved the settings in ${CONFIG_FILE}`);
    }
    return EXIT.ok;
  },
};

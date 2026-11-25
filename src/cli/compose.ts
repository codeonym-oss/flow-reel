import { relative } from "node:path";
import { dataDir, rememberWorkspace } from "../host/data.ts";
import { launch } from "../host/launch.ts";
import { credentialsFor, resolveSettings } from "../settings.ts";
import { CONFIG_FILE, withSettings, writeConfig } from "../workspace/config.ts";
import { findScript, reelFolder } from "../workspace/workspace.ts";
import { type Command, EXIT, parse } from "./command.ts";

export const compose: Command = {
  summary: "compose a script into a reel",
  usage: "flow-reel compose <script.reel.ts> [--out <dir>] [--no-sound] [--integration <name>] [--voice <name>] " +
    "[--speaker <name>] [--language <name>] [--model <id>] [--api-key-env <variable>] [--base-url <url>] [--save-config]",
  run(args) {
    const { positionals: [path], flags } = parse(args, { out: "text", "no-sound": "switch", integration: "text", voice: "text",
      speaker: "text", language: "text", model: "text", "api-key-env": "text", "base-url": "text", "save-config": "switch" }, { min: 1, max: 1 });
    const { workspace, script } = findScript(path);
    rememberWorkspace(dataDir(), workspace);
    const settings = resolveSettings(workspace.config, { integration: flags.integration, voice: flags.voice,
      speaker: flags.speaker, language: flags.language, model: flags.model, apiKeyEnv: flags["api-key-env"], baseUrl: flags["base-url"] });
    const reel = reelFolder(workspace, script, flags.out);
    const status = launch({ workspace, script, reel, settings, credentials: credentialsFor(settings, process.env),
      sound: !flags["no-sound"] });
    if (status !== 0) return EXIT.failed;
    console.error(`flow-reel: composed ${relative(process.cwd(), reel) || reel}`);
    if (flags["save-config"]) {
      writeConfig(workspace.root, withSettings(workspace.config, settings));
      console.error(`flow-reel: saved the settings in ${CONFIG_FILE}`);
    }
    return EXIT.ok;
  },
};

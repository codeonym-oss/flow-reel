import { dataDir } from "../host/data.ts";
import { startCompose } from "../host/new-run.ts";
import { CONFIG_FILE, withSettings, writeConfig } from "../workspace/config.ts";
import { type Command, EXIT, UsageError, parse } from "./command.ts";
import { announce, watchToEnd } from "./watch.ts";

export const compose: Command = {
  summary: "compose a script into a reel",
  usage: "flow-reel compose <script.reel.ts> [--out <dir>] [--no-sound] [--integration <name>] [--voice <name>] " +
    "[--speaker <name>] [--language <name>] [--model <id>] [--api-key-env <variable>] [--base-url <url>] [--save-config] [--detach] [--json]",
  async run(args) {
    const { positionals: [path], flags } = parse(args, { out: "text", "no-sound": "switch", integration: "text", voice: "text",
      speaker: "text", language: "text", model: "text", "api-key-env": "text", "base-url": "text", "save-config": "switch", detach: "switch", json: "switch" }, { min: 1, max: 1 });
    if (flags.detach && flags["save-config"]) throw new UsageError("--save-config saves once the reel is composed, so it can't go with --detach");
    const say = (message: string) => console.error(`flow-reel: ${message}`);
    const { id, run, workspace, settings } = await startCompose(dataDir(), { path, out: flags.out, sound: !flags["no-sound"], say,
      flags: { integration: flags.integration, voice: flags.voice, speaker: flags.speaker, language: flags.language, model: flags.model,
        apiKeyEnv: flags["api-key-env"], baseUrl: flags["base-url"] } });
    if (flags.detach) return announce(id, run, flags.json);
    const { code } = await watchToEnd(id, run, { json: flags.json, interrupt: "cancels" });
    if (code !== EXIT.ok) return code;
    if (flags["save-config"]) {
      writeConfig(workspace.root, withSettings(workspace.config, settings));
      say(`saved the settings in ${CONFIG_FILE}`);
    }
    return EXIT.ok;
  },
};

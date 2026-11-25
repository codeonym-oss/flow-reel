import { dataDir, localSlug, rememberWorkspace } from "../host/data.ts";
import { detectEngine, ensureImage, packageVersion, targetFor } from "../host/engine.ts";
import { createRun } from "../host/run-folder.ts";
import { startProcess } from "../host/start.ts";
import { credentialsFor, resolveSettings } from "../settings.ts";
import { CONFIG_FILE, withSettings, writeConfig } from "../workspace/config.ts";
import { findScript, reelFolder } from "../workspace/workspace.ts";
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
    const { workspace, script } = findScript(path);
    const data = dataDir();
    const known = rememberWorkspace(data, workspace);
    const settings = resolveSettings(workspace.config, { integration: flags.integration, voice: flags.voice,
      speaker: flags.speaker, language: flags.language, model: flags.model, apiKeyEnv: flags["api-key-env"], baseUrl: flags["base-url"] });
    const credentials = credentialsFor(settings, process.env);
    const version = packageVersion();
    const say = (message: string) => console.error(`flow-reel: ${message}`);
    const engine = detectEngine();
    const image = ensureImage(engine, version, targetFor(settings.voice.adapter), say);
    const reel = reelFolder(workspace, script, flags.out);
    const run = await createRun(data, { workspace, script, settings, sound: !flags["no-sound"], reel, credentials, flowReel: version });
    await startProcess(run, { engine, image });
    const id = `${localSlug(known)}/${run.number}`;
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

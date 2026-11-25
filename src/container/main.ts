#!/usr/bin/env node
// The composer image's entry point: composes one script, with the adapters chosen here.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromiumPainter } from "../adapters/chromium/painter.ts";
import { folderStore } from "../adapters/folder/store.ts";
import { playwright } from "../adapters/playwright/integration.ts";
import { compose } from "../composer/compose.ts";
import { KNOWN } from "../settings.ts";
import { type ComposeRequest, OUTPUT_MOUNT, SCRIPTS_MOUNT } from "./request.ts";

async function main([command, argument]: string[]): Promise<void> {
  if (command !== "compose" || argument === undefined) throw new Error("this image is run by the flow-reel command");
  const { script, reel, settings, brand, sound } = JSON.parse(argument) as ComposeRequest;
  const voice = KNOWN.voices[settings.voice.adapter].cloud
    ? (await import("../adapters/cloud/voice.ts")).cloudVoice(settings.voice)
    : (await import("../adapters/qwen/voice.ts")).qwenVoice(settings.voice);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
  await compose({ scriptsDir: SCRIPTS_MOUNT, script, reel: join(OUTPUT_MOUNT, reel), brand, sound },
    { integration: playwright, voice, store: folderStore, painter: chromiumPainter, composerVersion: version });
}

main(process.argv.slice(2)).then(() => process.exit(0), (error: Error) => {
  console.error(`flow-reel: ${error.message}`);
  process.exit(1);
});

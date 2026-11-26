#!/usr/bin/env node
// The composer image's entry point: runs one phase of a run, with the adapters chosen here.
import { join } from "node:path";
import { chromiumPainter } from "../adapters/chromium/painter.ts";
import { playwright } from "../adapters/playwright/integration.ts";
import { type Pictures, startPictures } from "../composer/media/pictures.ts";
import { record } from "../composer/phases/record.ts";
import { render } from "../composer/phases/render.ts";
import { voice } from "../composer/phases/voice.ts";
import type { Integration, Voice } from "../composer/ports.ts";
import { readJson } from "../composer/schema/read.ts";
import { type CueSheet, validateCues } from "../composer/schema/cues.ts";
import { CAPTURE_FILE, CUES_FILE, PLAN_FILE } from "../composer/schema/files.ts";
import { type Plan, validatePlan } from "../composer/schema/plan.ts";
import { KNOWN, type VoiceSettings } from "../settings.ts";
import { type ContainerInput, type ContainerMessage, type ContainerRequest, MOUNTS, lineReader } from "./protocol.ts";

const INTEGRATIONS: Record<string, Integration> = { playwright };

const voiceFor = async (settings: VoiceSettings): Promise<Voice> => KNOWN.voices[settings.adapter].cloud
  ? (await import("../adapters/cloud/voice.ts")).cloudVoice(settings)
  : (await import("../adapters/qwen/voice.ts")).qwenVoice(settings);

// The messages are this program's alone: whatever else writes to the output, such as a script's console.log, goes to
// the log.
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;
/** Resolves once the message has left, so that exiting right after doesn't lose it. */
const send = (message: ContainerMessage) => new Promise<void>((resolve) => { write(`${JSON.stringify(message)}\n`, () => resolve()); });
const report = (message: ContainerMessage) => { void send(message); };

async function run(request: ContainerRequest): Promise<void> {
  switch (request.phase) {
    case "record":
      return record({ scriptsDir: MOUNTS.scripts, script: request.script, brand: request.brand, out: MOUNTS.out },
        INTEGRATIONS[request.integration], report);
    case "voice":
      return voice({ cues: readJson<CueSheet>(join(MOUNTS.record, CUES_FILE), validateCues), previous: MOUNTS.previous, out: MOUNTS.out },
        await voiceFor(request.voice), report);
    case "render":
      return render({ plan: readJson<Plan>(join(MOUNTS.plan, PLAN_FILE), validatePlan), capture: join(MOUNTS.record, CAPTURE_FILE),
        audioRoot: MOUNTS.voice, scriptsDir: MOUNTS.scripts, brand: request.brand, out: MOUNTS.out }, chromiumPainter, report);
  }
}

const request = JSON.parse(process.argv[2] ?? "{}") as ContainerRequest;

// While someone watches the recording, a second grab sends pictures of the screen (GH-138 decisions 001 to 003). One
// that can't start, as before the screen is there, is tried again each second.
let watching = false;
let pictures: Pictures | undefined;
const sendPicture = (jpeg: Buffer) => {
  // A picture still waiting to leave is enough: newer ones are dropped meanwhile (decision 002).
  if (process.stdout.writableLength === 0) write(`${JSON.stringify({ type: "picture", jpeg: jpeg.toString("base64") } satisfies ContainerMessage)}\n`);
};
const grab = () => {
  if (!watching || pictures) return;
  pictures = startPictures(sendPicture, () => { pictures = undefined; setTimeout(grab, 1000).unref(); });
};
const input = lineReader((line) => {
  if (request.phase !== "record") return;
  watching = (line as ContainerInput) === "watch";
  if (watching) grab();
  else { pictures?.stop(); pictures = undefined; }
});

// The run's process holds the other end of the input: when it dies, this container has nobody to work for.
process.stdin.setEncoding("utf8").on("data", (chunk: string) => input.push(chunk))
  .on("close", () => process.exit(1)).on("error", () => process.exit(1));

run(request).then(() => { write("", () => process.exit(0)); }, async (error: Error) => {
  console.error(error.stack ?? error.message);
  await send({ type: "failed", message: error.message });
  process.exit(1);
});

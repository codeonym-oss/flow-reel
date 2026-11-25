// Runs a run's phases. Recording, voicing and rendering happen in containers; planning and publishing in this process.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { folderStore } from "../adapters/folder/store.ts";
import { planReel } from "../composer/phases/plan.ts";
import { PLAN_FILE } from "../composer/schema/files.ts";
import type { ContainerRequest } from "../container/protocol.ts";
import type { Phase } from "../run/phases.ts";
import { type PhaseHooks, runContainer } from "./container.ts";
import type { Engine } from "./engine.ts";
import { buildReel, readCues, readVoiced } from "./reel.ts";
import { makeResult } from "./results.ts";
import type { Run } from "./run-folder.ts";

export interface Composing {
  run: Run;
  engine: Engine;
  image: string;
}

const containerRequest = ({ request }: Run, phase: ContainerRequest["phase"]): ContainerRequest => {
  const { script, settings, brand } = request;
  if (phase === "record") return { phase, script: script.path, brand, integration: settings.integration };
  return phase === "voice" ? { phase, voice: settings.voice } : { phase, brand };
};

/** Runs one phase, whose inputs are ready, and keeps its result. */
export async function runPhase(phase: Phase, { run, engine, image }: Composing, hooks: PhaseHooks): Promise<void> {
  const { dir, request } = run;
  switch (phase) {
    case "record": case "voice": case "render":
      return makeResult(dir, phase, (out) => runContainer({ engine, image, name: `flow-reel-${phase}-${randomUUID()}`, runDir: dir, out,
        request: containerRequest(run, phase), credentials: request.credentials,
        uid: process.getuid?.() ?? 1000, gid: process.getgid?.() ?? 1000 }, hooks));
    case "plan":
      return makeResult(dir, phase, async (out) => {
        const plan = planReel(readCues(dir), readVoiced(dir), { brand: request.brand, sound: request.sound });
        writeFileSync(join(out, PLAN_FILE), `${JSON.stringify(plan, null, 2)}\n`);
      });
    case "publish":
      return folderStore.publish(await buildReel(dir, request.flowReel), request.reel);
  }
}

// The local voice (GH-4 decision 002): Qwen3-TTS in a Python worker, offline, with a fixed seed.
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Voice } from "../../composer/ports.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const qwen: Voice = {
  voice: { adapter: "qwen3-tts-0.6b", voice: "Ryan", seed: 0 },
  synthesize(jobs) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(join(root, "tts-venv/bin/python"), [join(root, "docker/tts/worker.py")], {
        env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
        stdio: ["pipe", "ignore", "pipe"], timeout: 900_000, killSignal: "SIGKILL",
      });
      let diagnostics = "";
      child.stderr.on("data", (chunk: Buffer) => { diagnostics = (diagnostics + chunk).slice(-65536); });
      child.once("error", (error) => reject(new Error(`Qwen TTS could not start: ${error.message}`, { cause: error })));
      child.stdin.on("error", () => {}); // startup/exit errors are reported with the worker diagnostics
      child.once("close", (code, signal) => {
        if (code !== 0) reject(new Error(`Qwen TTS failed (${signal ?? code}): ${diagnostics.trim()}`));
        else {
          if (diagnostics) process.stderr.write(diagnostics);
          resolve();
        }
      });
      child.stdin.end(JSON.stringify(jobs));
    });
  },
};


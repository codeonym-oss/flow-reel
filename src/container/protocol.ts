// What a run's process and its containers say to each other (GH-108 decision 011). The process passes one request as the
// container's argument; the container answers with one JSON message per line on its output, and ends when its input
// closes. Both sides are the same version of flow-reel: the image's tag is the package's version.
import type { Brand } from "../composer/cards/brand.ts";
import type { PhaseProgress } from "../composer/progress.ts";
import type { VoiceSettings } from "../settings.ts";

/** The phases that need the browser, the voice or ffmpeg, so a container. */
export type ContainerRequest =
  | { phase: "record"; script: string; brand: Brand; integration: string }
  | { phase: "voice"; voice: VoiceSettings }
  | { phase: "render"; brand: Brand };

export type ContainerMessage = PhaseProgress
  /** The last message of a phase that didn't finish; the container's exit code isn't 0 either. */
  | { type: "failed"; message: string };

/** Where a container finds what its phase reads, and writes. Each is a mount, read-only except `out`. */
export const MOUNTS = { scripts: "/scripts", previous: "/previous", record: "/record", voice: "/voice", plan: "/plan", out: "/out" } as const;
export type Mount = keyof typeof MOUNTS;

/** The mounts each phase gets, besides `out`. */
export const READS: Record<ContainerRequest["phase"], readonly Exclude<Mount, "out">[]> = {
  record: ["scripts"],
  voice: ["record", "previous"],
  render: ["scripts", "record", "voice", "plan"],
};

/** Cuts a stream's text into lines, whatever pieces it arrives in. Empty lines are left out. */
export function lineReader(line: (text: string) => void) {
  let rest = "";
  return {
    push(chunk: string) {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop()!;
      for (const text of lines) if (text) line(text);
    },
    end() {
      if (rest) line(rest);
      rest = "";
    },
  };
}

/** Reads the messages in a container's output; a line that isn't one is passed to `stray`. */
export const messageReader = (message: (message: ContainerMessage) => void, stray: (line: string) => void) => lineReader((text) => {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return stray(text); }
  if (typeof value === "object" && value !== null && "type" in value) message(value as ContainerMessage);
  else stray(text);
});

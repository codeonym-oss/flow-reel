// What a run is doing, as the person or the program watching it reads it: one line per thing that happened, and on a
// terminal a last line that counts the time.
import type { PhaseProgress } from "../composer/progress.ts";
import type { Entry } from "../run/journal.ts";
import type { Phase } from "../run/phases.ts";

export interface View {
  show(entry: Entry): void;
  /** Nothing more will be shown. */
  end(): void;
}

const DOING: Record<Phase, string> = { record: "recording", voice: "voicing", plan: "planning", render: "rendering", publish: "publishing" };

/** What an entry says to a person, or undefined when it says nothing. */
export function lineFor(entry: Entry): string | undefined {
  switch (entry.type) {
    case "phase-started": return DOING[entry.phase];
    case "phase-finished": return entry.reused ? `${DOING[entry.phase]}: already done` : undefined;
    case "progress": return lineForProgress(entry.what as PhaseProgress);
    default: return undefined;
  }
}

function lineForProgress(what: PhaseProgress): string | undefined {
  switch (what.type) {
    case "step": return `  step ${what.index + 1}${what.comment ? `: ${what.comment.replace(/\s+/g, " ")}` : ""}`;
    case "voiced": return what.spoken + what.reused ? `voiced ${what.spoken} of ${what.spoken + what.reused} comments (${what.reused} reused)` : undefined;
    case "drawing": return `  drawing the ${what.what}`;
  }
}

/** One line per thing that happened, for a file, a pipe or CI. */
export const plainView = (write: (text: string) => void = (text) => { process.stderr.write(text); }): View => ({
  show(entry) {
    const line = lineFor(entry);
    if (line !== undefined) write(`flow-reel: ${line}\n`);
  },
  end() {},
});

const CLEAR = "\r\x1b[2K";

/** Like `plainView`, with a last line that says how long the phase has taken. */
export function liveView(terminal: { write(text: string): unknown; columns?: number }, now: () => number = Date.now): View {
  let doing: { what: string; since: number } | undefined;
  const status = () => {
    if (doing) terminal.write(`${CLEAR}${`${doing.what}, ${Math.round((now() - doing.since) / 1000)} s`.slice(0, (terminal.columns ?? 80) - 1)}`);
  };
  const timer = setInterval(status, 1000);
  timer.unref();
  return {
    show(entry) {
      const line = lineFor(entry);
      if (line !== undefined) terminal.write(`${doing ? CLEAR : ""}flow-reel: ${line}\n`);
      if (entry.type === "phase-started") doing = { what: DOING[entry.phase], since: Date.parse(entry.at) };
      else if (entry.type !== "progress") { if (doing) terminal.write(CLEAR); doing = undefined; }
      status();
    },
    end() {
      clearInterval(timer);
      if (doing) terminal.write(CLEAR);
      doing = undefined;
    },
  };
}

/** The journal's entries as JSON lines on the output, each with the run it belongs to. */
export const jsonView = (run: string, write: (text: string) => void = (text) => { process.stdout.write(text); }): View => ({
  show(entry) { write(`${JSON.stringify({ run, ...entry })}\n`); },
  end() {},
});

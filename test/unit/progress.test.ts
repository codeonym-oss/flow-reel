import { expect, it } from "vitest";
import { jsonView, liveView, plainView } from "../../src/cli/progress.ts";
import { entry } from "../../src/run/journal.ts";
import type { RunEvent } from "../../src/run/machine.ts";

const START = Date.parse("2026-11-25T10:00:00Z");
const at = (event: RunEvent, seconds = 0) => entry(event, new Date(START + seconds * 1000));
const EVENTS: RunEvent[] = [
  { type: "created" },
  { type: "waiting", phase: "record", behind: "shop/11" },
  { type: "phase-started", phase: "record" },
  { type: "progress", phase: "record", what: { type: "step", index: 0, comment: "Open the\n  shop" } },
  { type: "progress", phase: "record", what: { type: "step", index: 1 } },
  { type: "phase-finished", phase: "record" },
  { type: "phase-started", phase: "voice" },
  { type: "progress", phase: "voice", what: { type: "voiced", spoken: 1, reused: 2 } },
  { type: "phase-finished", phase: "voice" },
  { type: "phase-finished", phase: "plan", reused: true },
  { type: "phase-started", phase: "render" },
  { type: "progress", phase: "render", what: { type: "drawing", what: "cards" } },
  { type: "phase-finished", phase: "render" },
  { type: "phase-started", phase: "publish" },
];

it("says each thing that happens on its own line", () => {
  let text = "";
  const view = plainView((more) => { text += more; });
  EVENTS.forEach((event) => view.show(at(event)));
  expect(text.split("\n")).toEqual(["flow-reel: waiting for shop/11 before recording", "flow-reel: recording", "flow-reel:   step 1: Open the shop", "flow-reel:   step 2", "flow-reel: voicing",
    "flow-reel: voiced 1 of 3 comments (2 reused)", "flow-reel: planning: already done", "flow-reel: rendering", "flow-reel:   drawing the cards",
    "flow-reel: publishing", ""]);
});

it("says nothing of a reel without comments being voiced", () => {
  let text = "";
  plainView((more) => { text += more; }).show(at({ type: "progress", phase: "voice", what: { type: "voiced", spoken: 0, reused: 0 } }));
  expect(text).toBe("");
});

it("ends a terminal on a line that counts the phase's time, and leaves none behind", () => {
  let text = "";
  const screen = () => text.split("\n").map((line) => line.split("\r\x1b[2K").at(-1));
  const view = liveView({ write: (more: string) => { text += more; }, columns: 80 }, () => START + 12_000);
  view.show(at(EVENTS[2]));
  expect(screen()).toEqual(["flow-reel: recording", "recording, 12 s"]);
  view.show(at(EVENTS[3], 5));
  expect(screen()).toEqual(["flow-reel: recording", "flow-reel:   step 1: Open the shop", "recording, 12 s"]);
  view.show(at(EVENTS[5], 11));
  expect(screen().at(-1)).toBe("");
  view.show(at(EVENTS[6], 11));
  expect(screen().at(-1)).toBe("voicing, 1 s");
  view.end();
  expect(screen().at(-1)).toBe("");
});

it("prints the journal's entries with the run they belong to", () => {
  let text = "";
  jsonView("shop/12", (more) => { text += more; }).show(at({ type: "phase-started", phase: "record" }));
  expect(JSON.parse(text)).toEqual({ run: "shop/12", v: 1, at: "2026-11-25T10:00:00.000Z", type: "phase-started", phase: "record" });
});

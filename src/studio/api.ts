// What the studio's server and its web app say to each other (GH-109 decision 008). Types only: the server imports them,
// and the web app imports them with `import type`, so both sides are checked against the same shapes.

/** The version of the messages below; a client of another version is refused. */
export const STUDIO_API_VERSION = 1;

/** The screens of the studio, each at its own path. */
export const SCREENS = ["workspaces", "scripts", "run", "reel"] as const;
export type Screen = typeof SCREENS[number];

/** `GET /api/hello`: the studio answering, and which flow-reel it is. */
export interface Hello { v: typeof STUDIO_API_VERSION; version: string }

/** What the server sends on a WebSocket, as text. On a run's socket (`/ws?run=<id>`, GH-137 decision 001): `run` first,
 * then each batch of new `entries` followed by the `run` they lead to. */
export type ServerMessage = { v: typeof STUDIO_API_VERSION } & (
  | { type: "hello"; version: string }
  | { type: "run"; run: LiveRun }
  | { type: "entries"; entries: RunEntry[] }
  | { type: "problem"; error: string });

/** What the web app sends on a WebSocket, as text: `cancel` on a run's socket (GH-137 decision 002). */
export type ClientMessage = { v: typeof STUDIO_API_VERSION; type: "ping" | "cancel" };

/** A line of a run's journal: what happened, and when. */
export interface RunEntry { at: string; type: string; phase?: string; [key: string]: unknown }

/** A watched run and the state its journal leads to. */
export interface LiveRun {
  id: string;
  /** Its workspace's id. */
  workspace: string;
  script: string;
  /** The script's path in the scripts folder. */
  path: string;
  startedAt: string;
  endedAt?: string;
  state: RunView["state"];
  /** The phase it is in, or ended in. */
  phase?: string;
  finished: string[];
  waiting?: { phase: string; behind?: string };
  cancelling: boolean;
  /** Why it ended, unless it is done. */
  why?: string;
  /** The reel, once done. */
  reel?: string;
  /** The phase it can go on from, once ended. */
  resume?: string;
  /** Why it can't go on, once ended. */
  lost?: string;
  voice: string;
  /** The flow-reel that started it. */
  flowReel: string;
}

/** `POST /api/runs/resume`: let a run go on, as `flow-reel resume --detach`. */
export interface ResumeRun { run: string }

/** `GET /api/log?run=<id>`: the end of what the run's script, browser and renderer printed. */
export interface RunLog { text: string; cut: number }

/** A run as the lists show it (`GET /api/runs`). */
export interface RunView {
  /** `shop/12`. */
  id: string;
  workspace: string;
  script: string;
  startedAt: string;
  endedAt?: string;
  state: "queued" | "running" | "held" | "stopped" | "failed" | "done" | "cancelled";
  /** The phase it is in, or ended in. */
  phase?: string;
  /** The phases that are finished, of five. */
  finished: number;
  /** It waits for its turn at heavy work, behind this run. */
  waiting?: { phase: string; behind?: string };
  /** Why it ended, unless it is done. */
  why?: string;
  /** It can go on from this phase, or can't, and why. */
  resume?: string;
  lost?: string;
  /** Its heavy files are still there. */
  files: boolean;
}

/** A workspace on this computer (`GET /api/workspaces`). */
export interface WorkspaceView {
  id: string;
  /** The name commands use for it here. */
  slug: string;
  title: string;
  /** The first of its folders that still holds it, or the first it had. */
  root: string;
  /** None of its folders holds it any more. */
  missing: boolean;
  /** How many scripts it has; none when it is missing. */
  scripts: number;
  runs: number;
  /** Its newest run. */
  latest?: RunView;
  /** Its last runs, oldest first, at most 12: their state and how many seconds they took or have taken. */
  last: { state: RunView["state"]; seconds: number }[];
  /** The size of its runs' heavy files. */
  bytes: number;
}

/** A run's turn at heavy work, or its wait for one (`GET /api/today?since=<ISO time>`). */
export interface TurnView {
  run: string;
  workspace: string;
  phase: string;
  /** Its turn, or waiting for it. */
  kind: "turn" | "wait";
  from: string;
  /** Going on when absent. */
  to?: string;
  state: RunView["state"];
}

/** `POST /api/workspaces`: a project's folder, absolute or from `~/`; `init` makes it a workspace first. */
export interface AddWorkspace { path: string; init?: { title: string } }
export type AddedWorkspace =
  | { added: { id: string; slug: string; title: string } }
  /** It has no flow-reel.json: what `flow-reel init` would propose. */
  | { needs: "init"; root: string; title: string; scripts: string };

/** `GET /api/clean?workspace=<id>`: what Clean would remove now. `POST /api/clean` with `{ workspace }` removes it. */
export interface CleanPreview { runs: number; bytes: number }
export interface Cleaned { runs: number; bytes: number }

/** The answer to a request that couldn't be done. */
export interface Problem { error: string }

/** What a script's last reel holds (GH-136 decision 001). */
export interface ReelCounts { steps: number; comments: number; sounds: number; effects: number; cards: number; ms: number }

/** A script of a workspace (`GET /api/scripts?workspace=<id>`). */
export interface ScriptView {
  /** Its path in the scripts folder without `.reel.ts`: `admin/refund`. */
  name: string;
  /** Its path in the scripts folder. */
  path: string;
  /** Its last reel, when it has one. */
  reel?: ReelCounts & { at: string };
  /** Its last runs, newest first, at most 5. */
  runs: RunView[];
  /** Run again on save is on. */
  onSave: boolean;
  /** Why the last run a save started couldn't start. */
  onSaveFailed?: string;
}

export interface ScriptsView {
  workspace: { id: string; slug: string; title: string; root: string; scripts: string };
  scripts: ScriptView[];
}

/** A script's source, read only, and what changed since its last reel (`GET /api/script?workspace=&name=`). */
export interface ScriptSource {
  name: string;
  path: string;
  lines: string[];
  /** The lines (from 1) that changed since the last reel; "unknown" when its run's copy was cleaned. */
  changed: number[] | "unknown";
  /** It has no reel to compare with. */
  noReel?: true;
}

/** `POST /api/scripts/open`: a script's full path. */
export interface OpenScript { path: string }
export interface OpenedScript { workspace: string; slug: string; name: string }

/** `POST /api/runs`: run a script, as `flow-reel compose --detach`. */
export interface StartRun { workspace: string; name: string }
export interface StartedRun { id: string }

/** `POST /api/on-save`: turn Run again on save on or off for a script. */
export interface OnSaveSwitch { workspace: string; name: string; on: boolean }

/** `GET /api/score?run=<id>`: a recorded run's score, from its cue sheet, on the recording's clock (GH-139 decisions 001,
 * 002). Step pictures are at `GET /api/step-picture?run=<id>&step=<index>` when `picture` is true. */
export interface Score {
  durationMs: number;
  steps: { index: number; comment?: string; startMs: number; endMs: number; picture: boolean }[];
  marks: ScoreMark[];
}

/** A sound, an effect or a card on the score: when, for how long, and what it is. */
export interface ScoreMark { lane: "sounds" | "effects" | "cards"; t: number; ms?: number; label: string }

/** `GET /api/reel?run=<id>`: a run's own reel, on the video's clock (GH-140 decisions 001, 002); its files are at
 * `GET /api/reel-file?run=<id>&path=<path>`, with byte ranges. */
export interface ReelView extends Score {
  /** The run's reel folder. */
  folder: string;
  files: { path: string; bytes: number }[];
  bytes: number;
  voice?: string;
}

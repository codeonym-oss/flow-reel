// What the studio's server and its web app say to each other (GH-109 decision 008). Types only: the server imports them,
// and the web app imports them with `import type`, so both sides are checked against the same shapes.

/** The version of the messages below; a client of another version is refused. */
export const STUDIO_API_VERSION = 1;

/** The screens of the studio, each at its own path. */
export const SCREENS = ["workspaces", "scripts", "run", "reel"] as const;
export type Screen = typeof SCREENS[number];

/** `GET /api/hello`: the studio answering, and which flow-reel it is. */
export interface Hello { v: typeof STUDIO_API_VERSION; version: string }

/** What the server sends on a WebSocket, as text. Later tickets add a run's events. */
export type ServerMessage = { v: typeof STUDIO_API_VERSION; type: "hello"; version: string };

/** What the web app sends on a WebSocket, as text. Later tickets add commands. */
export type ClientMessage = { v: typeof STUDIO_API_VERSION; type: "ping" };

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

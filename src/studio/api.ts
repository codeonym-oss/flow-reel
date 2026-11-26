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

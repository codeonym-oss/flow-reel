# 008: HTTP for lists, a WebSocket per watched run, and one shared file of types

**Date:** 2026-11-26 (grilling, Q6; the person was fine with 1 or 3, and took the recommendation: "recoms")

**Question:** how does the browser talk to the studio's server?

**Decision:**

- **HTTP with JSON** for what is read once: workspaces, scripts, runs, a reel's files.
- **One WebSocket per watched run.** It carries the run's journal events as text and the live pictures as binary, and
  takes commands (cancel in this story; story 3 adds `hold`, `step`, `release` and remote-screen input). The server
  relays them from the run's own pipe (story GH-108).
- **One TypeScript file of the requests, events and commands,** imported by the server and the Preact client, so both
  sides are checked against the same types.

- **Why:** no extra library; pictures stay binary; story 3 uses the same connection; typed calls without a framework.
- **Accepted cost:** the types file is written and kept by hand.
- **Not chosen:** server-sent events with a video stream (two connections per run, slower input for story 3); tRPC or
  GraphQL (a layer a local tool doesn't need, and live pictures as JSON or a second connection).

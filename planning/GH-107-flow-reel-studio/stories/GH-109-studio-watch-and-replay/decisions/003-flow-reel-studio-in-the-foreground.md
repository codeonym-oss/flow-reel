# 003: `flow-reel studio` runs the studio in the foreground

**Date:** 2026-11-26 (grilling, Q3; agreed: "1")

**Question:** how is the studio started, and how long does it live?

**Decision:** **`flow-reel studio` starts the server, opens the browser at `http://localhost:<port>`, and stays in that
terminal. Ctrl+C stops the studio; runs go on (epic decision 023).**

- **Why:** the simplest to start and stop, and nothing is left behind.
- **Accepted cost:** a terminal stays open while the studio is used.
- **Not chosen:** a background service (one more long-lived process, a stop command, updates); started by every
  `compose` (a server nobody asked for, in CI too).

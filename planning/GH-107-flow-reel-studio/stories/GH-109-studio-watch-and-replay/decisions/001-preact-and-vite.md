# 001: The studio's web app is built with Preact and Vite

**Date:** 2026-11-26 (grilling, Q1; agreed: "1")

**Question:** what is the studio's web app built with?

**Decision:** **Preact, built with Vite ahead of time.** The built files ship inside the npm package and are served by
flow-reel's embedded server with `node:http`. No runtime dependency is added; Preact and Vite are dev dependencies.

- **Why:** components for the score and five screens, at about 4 KB of runtime.
- **Accepted cost:** a build step for the web app.
- **Not chosen:** plain TypeScript (about twice the UI code); React (about ten times Preact's size for nothing needed);
  Svelte (a second style of code, against epic decision 030).

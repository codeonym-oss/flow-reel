# 003: Run starts a run as `flow-reel compose --detach` does, with the studio's environment

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what does **Run** start, and where does a cloud voice's key come from?

**Decision:**

- `POST /api/runs` with the script's path starts a run as `compose --detach` does: the workspace's settings, the
  engine and image checks, `createRun`, `startProcess`. The answer is the run's id; the screen goes to it.
- The voice's key comes from the environment the studio was started in, as for `compose`. When it isn't there, the
  run is refused with the variable's name; the studio never asks for a key (epic rule).
- The code they share moves from `src/cli/compose.ts` to `src/host/`, so both start runs the same way.

- **Why:** a run the studio starts must be the same run `flow-reel runs` lists and `watch` follows.

# 001: The lists come by HTTP, asked again every 2 seconds while the screen shows

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how do runs started in a terminal or by an agent appear without reloading?

**Decision:**

- `GET /api/workspaces`, `GET /api/runs` and `GET /api/today` answer JSON (story decision 008: HTTP for lists).
- The Workspaces screen asks them again every 2 seconds while the tab is visible, and at once when it becomes visible.
- Each answer is read from the data folder as the commands read it: `knownWorkspaces`, `trackedRuns` (its index makes
  a long history cheap), the journals of the runs that are going.

- **Why:** the run's WebSocket (008) is for one watched run. A file watcher on every workspace's runs folder adds a
  moving part for a delay nobody notices at 2 seconds.
- **Not chosen:** `fs.watch` on the data folder (not recursive on Linux for older Node, and it misses network folders);
  a WebSocket for lists (008 keeps them HTTP).

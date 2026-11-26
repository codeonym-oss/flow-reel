# 002: The plugin's example has no `flow-reel.json`

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **its README says to run `flow-reel init` in the copy; the example ships the app, the script and the brief.**

- **Why:** a workspace's id must be its own. Every copy of a shipped file would share one id, and so one history.
- **Accepted cost:** the example shows its settings as words, not as a file.

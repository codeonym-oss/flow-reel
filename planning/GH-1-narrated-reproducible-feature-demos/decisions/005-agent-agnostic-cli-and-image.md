# 005: The product is a CLI plus a container image; agent plugins are thin skills on top

**Date:** 2026-11-02 (shaping, Q4; agreed: "yes!")

**Question:** is this a Claude plugin, or a tool any agent can use?

**Decision:** **agent-agnostic.** The CLI and the image do all the work; a Claude Code plugin (first) and others are
thin skills that teach the loop and call the CLI.

- **Why:** Codex, Cursor and others should be able to use it too; a skill alone can't ship a recorder.
- **Not chosen:** a Claude-only plugin holding the logic.

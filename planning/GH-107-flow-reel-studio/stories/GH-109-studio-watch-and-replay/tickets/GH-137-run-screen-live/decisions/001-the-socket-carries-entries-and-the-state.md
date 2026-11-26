# 001: A run's socket carries its journal entries and the state they lead to

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what does the WebSocket of a watched run (story decision 008) send, and who works out the run's state?

**Decision:**

- `/ws?run=<id>` follows the run's journal as `flow-reel watch` does (`follow`), from its first entry: reopening the
  page replays everything that happened meanwhile (epic 031).
- Each batch of new entries goes out as `entries`, followed by `run`: the state the server folded them into with the
  run machine, plus, once ended, whether it can go on (`whatNext`). The page never re-implements the machine.
- Closing the tab or the studio closes only the socket; the run's own process goes on.

- **Why:** one source of truth for a run's state, the same as the CLI's; a reload costs one journal read.
- **Not chosen:** a page that replays entries itself (a second copy of the machine to keep in step).

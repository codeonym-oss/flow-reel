# 002: A gate holds a run once; a run whose reel is in place is done

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **a run let through a gate isn't held there again: `step` holds it at the next one. A cancel that comes after
publishing finished leaves the run `done`.**

- **Why:** without the first, `step` before a phase would hold it at the same gate forever. Without the second, a run would be
  called cancelled while its reel is in the project.

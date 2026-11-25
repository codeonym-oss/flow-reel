# 010: A script can have several unfinished runs, and its reel is never replaced by an older run's

**Date:** 2026-11-25 (grilling, Q9; agreed: "1, never replaced by an older run's")

**Question:** what happens when a script that already has an unfinished run is composed?

**Decision:** **it is allowed, and publishing follows the order the runs were started.** When a newer run has already
published, the older one finishes without replacing the reel, keeps its own in its run folder, and says so. The same holds
when an old run is resumed after a newer one has published.

- **Why:** nothing finished is lost, nothing is cancelled unasked, and the project ends on the newest version.
- **Accepted cost:** a run can end `done`, with exit code 0, and its reel only in its run folder.
- **Not chosen:** refusing while one is unfinished (a wait or a cancel for every quick fix); cancelling the older run (it can
  throw away a recording).

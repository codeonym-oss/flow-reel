# 002: A finished run is one that can't go on, and those that are done are counted apart

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **finished is done, cancelled, or ended with its recording lost. `keepRuns` in `flow-reel.json` (5 by default)
counts the runs that are done, and as many of the others, by when they ended. A run trims its script's runs when it ends.**

- **Why:** five cancelled runs in a row must not cost the files of the five that worked (004 wants them to compare with).
- **Accepted cost:** a script that fails often keeps up to ten runs' files.

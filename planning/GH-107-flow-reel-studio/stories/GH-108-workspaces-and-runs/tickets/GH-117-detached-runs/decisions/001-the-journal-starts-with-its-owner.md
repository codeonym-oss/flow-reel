# 001: A run starts when its own process does

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **the command makes the run's folder, and the run's process starts its journal once it holds the lock. A folder
without a journal isn't a run yet: no command lists it, and one whose process couldn't start is removed.**

- **Why:** between making the folder and the process taking its lock, nobody owns the run; a command that looked then would
  record it as stopped.

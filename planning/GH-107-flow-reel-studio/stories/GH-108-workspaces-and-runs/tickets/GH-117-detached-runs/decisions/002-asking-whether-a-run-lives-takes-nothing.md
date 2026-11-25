# 002: Asking whether a run lives doesn't take its lock

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **clients ask with a shared lock, and take the lock only to record that a run stopped. An owner waits up to 5
seconds for them.**

- **Why:** with exclusive probes, two commands asking at once would each see the other and call a dead run alive, and a
  probe could keep a resumed run from starting.

# 031: A run is a pure state machine with phases and gates, and its journal is the truth

**Date:** 2026-11-25 (confirmed with the shared understanding: "yes, write the epic and story drafts")

**Decision:**

- **States:** queued, running, held, stopped, failed, done, cancelled. `next(run, event)` is a pure function, and the only
  thing that changes a state.
- **Phases:** record, voice, plan, render, publish. A phase's result counts only once complete (written under a temporary
  name, then renamed), and is reused only if its inputs and files still match.
- **Gates:** named points, before each step and before each phase, where a run can be held; with nobody holding it, it
  passes. Holds happen only there.
- **Control:** every client uses one versioned interface: watch the events, and send `hold`, `step`, `release` or
  `cancel`. Anyone watches, one client controls, and unknown commands are refused.
- **Journal:** each change is appended to the run's journal, which is the truth. The SQLite tracker is rebuilt from it.
- **Owner:** the run's process holds a lease that expires, so a dead one is noticed.
- **Cue sheet:** after recording, later phases read a saved cue sheet (`cues.json`) and never the script, which keeps
  editing a run possible later.
- **One recording at a time** on a computer. Held time doesn't count towards time limits.

- **Why:** it can be tested without Docker, nothing finished is lost, and editing, approval before publishing, breakpoints
  and a TUI fit without changing the structure.
- **Not chosen:** Temporal (005); SQLite as the truth (losing it would lose the runs).

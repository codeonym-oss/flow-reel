# 005: When a runner dies its recording is lost; voicing and rendering resume

**Date:** 2026-11-25 (grilling, after the person asked what happens when a job's container goes down; agreed: "yes to: …
do you accept losing the recording when a runner dies, with voicing and rendering resumable?")

**Question:** what is kept when a container dies in the middle of a run?

**Decision:** **recording starts the script again, and only when the person asks; voicing and rendering continue from
what is saved.** No container holds the only copy of a finished phase's result. Temporal was considered and not used.

- **Why:** the browser's state can't be restored, and rerunning a script can repeat real actions such as a payment.
- **Not chosen:** replaying to the failed step (repeats the actions and can't guarantee the same state); Temporal (a
  server and workers to run, a second history beside the run's files, and it can't restore a browser either).

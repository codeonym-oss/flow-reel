# 004: Exit codes, and what ends a compose

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **`compose`, `watch` and `wait` exit with 0 for done, 1 for failed, 3 for stopped and 4 for cancelled; 2 stays a
usage error. In `compose`, Ctrl+C and SIGTERM cancel the run and wait for it to end, and a second one leaves; a closed
terminal (SIGHUP) leaves the run going.** `--save-config` is refused with `--detach`: it saves what worked.

- **Why:** CI ends a job with SIGINT or SIGTERM, and must not leave a run behind.

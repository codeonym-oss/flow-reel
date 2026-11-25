# 006: `resume` never records: a run whose recording was lost is refused

**Date:** 2026-11-25 (grilling, Q6; agreed: "1, resume refuses and says what to run")

**Question:** what does `resume` do to a run that ended while recording?

**Decision:** **it refuses, says where the recording was lost, and names the `compose` command that records again, as a new
run.** The old run stays in the history as it ended.

- **Why:** `resume` never repeats an action of the script, so it is always safe to run; one run has one recording of one
  version of the script (005).
- **Accepted cost:** one more command, and a separate run.
- **Not chosen:** recording again in the same run (the same command would be harmless in one phase and could pay twice in
  another); `resume --record` (one run with two recordings, possibly of two versions).
- **Open:** whether such a run's state is `failed` or `stopped` (epic 016).

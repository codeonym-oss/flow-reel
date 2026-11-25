# 016: A held run waits for a person, then becomes `stopped`

**Date:** 2026-11-25 (grilling; agreed: "A, wait then become stopped")

**Question:** what happens when a run is held and nobody comes?

**Decision:** **it waits up to a configurable limit, then becomes `stopped`.** About 15 minutes for an interrupt, and 5
after a controlling client disappears. `--unattended`, for CI, fails at the first interrupt instead of waiting. A run
that died is `stopped` too, so "interrupt" names only the script word.

- **Not chosen:** failing an interrupt at once when no studio is open (the person couldn't start it after being asked);
  waiting forever by default (the recording slot stays blocked).
- **Open:** whether a script can ask for no limit.

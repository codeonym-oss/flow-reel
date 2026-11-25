# 012: A run is one continuous recording, and its pauses are cut out

**Superseded by 018.**

**Date:** 2026-11-25 (grilling; agreed: "A, one recording with pauses cut out")

**Question:** how does a run pause between steps?

**Decision:** **the recording never stops; a pause holds the script before its next step, and the composer cuts the
paused time from the reel.** The page's JavaScript clock is frozen while paused (Playwright's `clock.pauseAt`).

- **Why:** `skip()` already cuts a stretch of the recording, so this is the same cut without the card.
- **Accepted cost:** CSS animations and data from a server keep moving, so the picture can jump at the cut; the
  recording file grows while paused.
- **To check when built:** that freezing and resuming the clock leaves the page working.
- **Not chosen:** one recording file per step (every clip needs its own start, stop and timing marker); no pausing
  (the person can't stop live to look at their app).

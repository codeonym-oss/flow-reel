# 006: Slower zoom transitions and longer close-ups

**Date:** 2026-11-11 (implementation playback review; agreed: "Yes—make zoom slower and hold close-ups longer (recommended).")

**Supersedes 002** (its 300 ms / 1000 ms / 400 ms timing values only).

**Question:** does "duration too short" mean the zoomed close-up or the full demo?

**Decision:** **ease in over 650 ms, keep the close-up until 2000 ms after the most recent click or typing ends, and ease out over 800 ms.** Keep the existing activity-merging rules and preserve total video, narration, caption and transcript timing.

- **Why:** the first actual demo was functional, but the person reported abrupt transitions and short close-ups. Longer transitions provide more frames of motion; longer focus gives viewers time to read.
- **Not chosen:** extending the whole demo or narration timeline (the person clarified that the zoomed close-up was too short).

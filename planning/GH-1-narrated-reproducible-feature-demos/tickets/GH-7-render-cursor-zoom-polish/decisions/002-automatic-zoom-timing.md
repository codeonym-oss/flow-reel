# 002: Automatic zoom follows click and typing activity

**Timing values superseded by 006.**

**Date:** 2026-11-11 (ticket pass, Q2; agreed: "ok")

**Question:** use automatic activity timing, keep zoom through the whole step, or make zoom opt-in per step?

**Decision:** **zoom automatically on a click**, easing in over 300 ms. Remain zoomed until 1000 ms after the most recent click or the end of typing, then ease out over 400 ms. Actions during an active zoom window extend it instead of repeatedly zooming out and in. Hover and scrolling alone do not trigger zoom. No new demo-script controls are added.

- **Why:** consistently emphasizes interactions without authoring changes or holding a close-up for an entire narration pause.
- **Not chosen:** whole-step zoom (unnecessarily long close-ups); opt-in per-step API (extra authoring and configuration).

# 002: Start narration with its action

**Date:** 2026-11-11 (ticket pass, Q2; agreed: "ok")

**Question:** does narration begin at the step's start or after the action finishes?

**Decision:** **start each clip at the step's final `startMs`, alongside the action.** Preserve the action's
normal playback speed. Add a frame hold when speech needs more time than the captured action window. When the
action lasts longer than speech, it continues after the clip ends. Padding and exact frame boundaries are settled
separately.

- **Why:** a natural walkthrough pace with the explanation accompanying its action.
- **Not chosen:** completing the action first and then playing its entire narration over a held screen, which
  lengthens every narrated step.

# 007: Explicit cues mark the current time without pausing

**Date:** 2026-11-11 (ticket pass, Q6; agreed: "ok")

**Question:** should `sfx(name)` mark the current action time or wait for the cue to finish?

**Decision:** **provide a synchronous, nonblocking `sfx(name): void` helper in the demo body context.** Authors call it after the action or assertion the cue describes. The helper records the current runner time; post-processing places it on the calibrated, retimed delivery clock. It neither plays into the browser capture nor sleeps. Sound effects do not extend video duration; trim any sound tail at the delivery end.

- **Why:** preserve demo pacing and existing narration/hold timing while keeping cue placement explicit.
- **Not chosen:** an awaited helper that waits for each sound and lengthens recordings.
- **Compatibility:** existing demo bodies that use only `page` and `step` continue to work. Validate cue names at runtime, as demo scripts need not be type-checked before recording.

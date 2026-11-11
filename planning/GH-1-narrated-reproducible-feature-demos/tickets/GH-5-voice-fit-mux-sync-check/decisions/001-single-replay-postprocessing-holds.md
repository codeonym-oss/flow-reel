# 001: Add voice-fit holds after a single replay

**Date:** 2026-11-11 (ticket pass, Q1; agreed: "ok")

**Question:** how can the runner fit speech when narration becomes known only as the script calls `step()`?

**Decision:** **capture the script once, synthesize narration after capture, then extend the recorded video with
frame holds where speech needs more time.** Keep the existing imperative script API and execute each action once.
The screen is frozen during added holds. Shift transcript times, captions and events onto the final video timeline
together; the master consumed by later polish must agree with that timeline too.

This replaces the current GH-5 draft's proposal to synthesize all narration before recording. Voice/audio metadata
and the version 1 schema remain as shipped by GH-4. CPU synthesis stays outside real-time capture.

- **Why:** narration is discovered at runtime, and Qwen synthesis can take minutes. Postprocessing keeps capture
  free of that work and avoids another execution of application actions.
- **Not chosen:** a preparation replay, which repeats side effects and needs application resets; pausing capture
  to synthesize each step, which lets application state change during long unrecorded gaps.
- **To settle next:** narration placement, hold boundaries/padding, audio mix, and sync/comparison checks.

Feasibility reference: [FFmpeg tpad source](https://ffmpeg.org/doxygen/trunk/vf__tpad_8c.html) supports cloning
frames for holds. This decision does not prescribe the final filter graph.

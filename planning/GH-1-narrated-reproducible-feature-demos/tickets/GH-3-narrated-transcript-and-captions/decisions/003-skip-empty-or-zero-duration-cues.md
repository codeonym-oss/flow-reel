# 003: Skip captions with blank text or no duration

**Date:** 2026-11-10 (GH-3 ticket pass, Q3; recommended option 1, agreed: "ok")

**Question:** should blank narration or a zero-duration step skip its caption or fail the recording?

**Decision:** preserve every step and its original narration in the transcript. Emit a caption only when its
normalized narration is nonblank and `endMs > startMs`. Skipping a cue never removes a transcript step, changes
timing, extends a step, or fails an otherwise successful recording. Number emitted SRT cues consecutively.

- **Why:** intentionally silent and instantaneous actions remain valid, while subtitle files contain only usable
  cues on the recorded timeline.
- **Not chosen:** failing recordings that include these steps (unnecessarily forbids silent steps).
- **Cost accepted:** not every transcript step has a corresponding subtitle cue.

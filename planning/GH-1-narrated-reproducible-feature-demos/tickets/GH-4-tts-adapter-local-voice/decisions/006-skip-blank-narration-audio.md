# 006: Skip blank narration and retain step indexes in clip names

**Date:** 2026-11-10 (ticket pass, Q6; agreed: "ok")

**Question:** skip audio for blank narration or create a silent WAV?

**Decision:** **blank or missing narration produces no audio file and no step `audio` field.** Preserve the step
and original transcript text. Normalize whitespace in synthesis input by replacing whitespace runs with one space
and trimming; use plain text, without caption entity escaping. Nonblank narration is voiced even when its action
has zero duration. Clip names use the original zero-based step index, padded to at least three digits, so skipped
steps leave gaps (`000.wav`, `002.wav`).

- **Why:** matches blank-caption behavior without inventing a silence duration; step identities remain clear.
- **Not chosen:** silent WAVs for blank steps, or compacting filenames around skipped steps.

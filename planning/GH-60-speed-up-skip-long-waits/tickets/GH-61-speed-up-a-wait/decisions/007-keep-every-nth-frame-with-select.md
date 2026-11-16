# 007: A stretch keeps source frame round(i × factor) for output frame i, picked with select

**Date:** 2026-11-16 (ticket pass, Q7; the person answered "ok" to the recommendation)

**Question:** how are a sped-up stretch's frames produced?

**Decision:** output frame `i` of the stretch is source frame `round(i × factor)`, picked with ffmpeg's `select`; the
stretch is `ceil(frames / factor)` frames long, and `planTimeline` computes the same count, so audio and polish stay
frame-exact.

- **Why:** exact and repeatable, handles fractional factors, cheap; reads as fast-forward, which the badge announces.
- **Not chosen:** `setpts=PTS/factor` + `fps` (ffmpeg's rounding can differ by a frame from the plan, adding up over
  stretches); frame blending (`tmix`/`minterpolate`: slow, blurs text, polish's cursor no longer matches).

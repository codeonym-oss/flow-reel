# 005: Normalize the assembled voice track and preserve source clips

**Date:** 2026-11-11 (ticket pass, Q5; agreed: "ok")

**Question:** normalize delivered narration volume or retain Qwen's original output level?

**Decision:** **normalize the assembled voice track to a target of -16 LUFS with a -1.5 dBTP peak ceiling.**
Keep original generated WAV clips unchanged, including their recorded durations and complete-file SHA-256 hashes.
Normalization belongs to the assembled delivery audio, after its placement on the final timeline. Source clip
hashes remain the basis for the inherited same-audio comparison.

- **Why:** a consistent delivery level across demos while keeping the reproducible source clips available.
- **Not chosen:** using the original Qwen volume for delivery, which can vary between demos.
- **Verification:** measure the rendered audio rather than assuming filter options prove the result. Exact
  encoding settings, measurement tolerances and treatment of unmeasurable input belong in the implementation plan.

Source: [FFmpeg loudnorm documentation](https://ffmpeg.org/ffmpeg-filters.html#loudnorm), checked during the
ticket pass; supports measured two-pass loudness normalization. The numerical targets are this product's choice.

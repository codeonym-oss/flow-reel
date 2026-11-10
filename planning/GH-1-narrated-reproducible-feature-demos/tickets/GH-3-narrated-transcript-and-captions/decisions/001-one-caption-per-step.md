# 001: One caption cue per step, using its recorded boundaries

**Date:** 2026-11-10 (GH-3 ticket pass, Q1; recommended option 1, agreed: "ok")

**Question:** should long narration stay in one caption or be split into shorter cues?

**Decision:** emit one cue per captioned step, containing its complete narration, from `startMs` to `endMs`.
Do not split narration into separately timed chunks or extend the step for readability. GH-5 owns voice holds;
captions use the resulting boundaries when those holds exist.

- **Why:** the runner knows step boundaries but has no timing for individual words or sentences. The same rule
  works before and after voice is added.
- **Not chosen:** splitting long narration into shorter cues (would introduce estimated timing before voice exists).
- **Cost accepted:** long narration can occupy several lines, and short actions can give little reading time until
  GH-5 introduces voice holds.

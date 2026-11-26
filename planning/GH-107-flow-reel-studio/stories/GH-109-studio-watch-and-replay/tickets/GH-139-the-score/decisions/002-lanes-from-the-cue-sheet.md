# 002: Sounds, effects and cards come from the cue sheet

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** where do the Sounds, Effects and Cards lines come from?

**Decision:** **from the record result's `cues.json`, once the record phase is finished.** `GET /api/score?run=` reads
it and answers the steps (start, end, comment, picture or not) and the marks: sounds; zooms, speed-ups, skips,
flashes and overlays as effects; cards. While the script records, the score shows Steps and Comments from the
journal; the other lines say they fill in once the recording is done.

- **Why:** the cue sheet already holds every one of them with its time; nothing new crosses the container's pipes.
- **Accepted cost:** sounds and effects appear at the end of the record phase, not as they happen (about 15 s for the
  check kit's scripts).

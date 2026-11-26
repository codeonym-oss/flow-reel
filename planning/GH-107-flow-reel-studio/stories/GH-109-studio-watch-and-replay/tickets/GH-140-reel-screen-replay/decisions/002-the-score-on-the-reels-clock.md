# 002: Under the video, the score is on the reel's clock

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what does the score under the video show?

**Decision:** **the same score as the Run screen (GH-139), drawn from the reel's `transcript.json` and `events.json`,
which are on the video's clock.** Its playhead is the video's time; clicking the score, a step or a transcript line
plays from there. Step pictures are the run's, when its record result is still there.

- **Why:** one component, two clocks: the Run screen shows the recording, the Reel screen the finished video, comments
  stretched and speed-ups shortened.

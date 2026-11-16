# 008: A stretch keeps source frame floor(i × factor), not round (supersedes 007's rounding)

**Date:** 2026-11-16 (ticket pass, Q8; the person answered "ok" to the recommendation)

**Question:** decision 007's `round(i × factor)` and its length `ceil(frames / factor)` disagree (×1.5 over 2 frames:
round keeps 1 frame, ceil says 2), so the timeline would plan more frames than ffmpeg renders.

**Decision:** output frame `i` is source frame **`floor(i × factor)`**. The kept frames are then exactly
`ceil(frames / factor)`, as decision 007 says. In ffmpeg, frame `n` of the stretch is kept when
`ceil(n/f) < (n+1)/f`. The rest of 007 stands.

- **Not chosen:** keep `round` and count with the same rule (harder to read; ffmpeg and JS round halves differently).

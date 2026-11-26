# 001: The Run screen's score is on the recording's clock

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** what time does the Run screen's score show, before there is a reel?

**Decision:** **the recording's video clock, the one `cues.json` uses.** While the script records, each step's `step`
progress carries `t`, its start in milliseconds on that clock (taken before the timing marker is found, so it can be
off by a frame or two); once the record phase is finished, the score is drawn from the record result's `cues.json`,
exact. The reel's own time, with comments stretched and speed-ups shortened, is the Reel screen's (GH-140).

- **Why:** the journal's wall times include the browser starting and the timing marker; `t` lines up with what
  `cues.json` says afterwards, so the score doesn't jump when the recording is done.
- **Not chosen:** the journal's `at` times (a jump of about a second at the end of recording).

# 002: The agent explores, then writes a demo script that a deterministic runner replays while recording

**Date:** 2026-11-02 (shaping, Q2; agreed: "ok")

**Question:** how is the recording produced: live capture of the agent driving the app, a scripted replay, or live
capture cleaned up afterwards?

**Decision:** **explore → script → replay.** The agent explores freely with whatever browser tool it has, then writes
the demo as a script (Playwright steps, one narration line per step). A deterministic runner replays it on a virtual
display in the sandbox while recording, and logs each step's timestamp. Narration timing comes from those timestamps.

- **Why:** "reliable" means no think-time pauses or misclicks in the video, the same result on every run, a
  one-command re-record when the UI changes, and a script that can run in CI.
- **Not chosen:** live capture (records pauses and mistakes, not reproducible, transcript timed after the fact);
  live capture plus post-cleanup (fragile editing, still not reproducible).

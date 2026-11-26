# 001: A script's steps, comments, sounds, effects and cards are counted in its last reel

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** where do the Scripts screen's counts come from?

**Decision:** from the script's last reel in its output folder: `transcript.json` gives the steps and comments,
`events.json` the sounds, effects (zoom, flash, speed, skip, overlays) and cards, and the video's length. A script
without a reel shows none, and says so.

- **Why:** a script is code; counting its calls without running it would be wrong for loops and helpers. The reel is
  what the script did.
- **Not chosen:** parsing the script's source.

# 001: Recording, voicing and rendering have a limit; planning and publishing don't

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **`limits` in `flow-reel.json` gives minutes for `record` (60 by default), `voice` (60) and `render` (120), at
most a day. A run keeps the ones it started with.** Planning and publishing have none: they wait for nothing outside, and
publishing can't be ended half way. A run is only held between phases for now, when no limit counts; the story that holds
recordings (GH-109) stops the count.

- **Why:** generous enough for a slow app or a long reel, and a phase that hangs still ends.

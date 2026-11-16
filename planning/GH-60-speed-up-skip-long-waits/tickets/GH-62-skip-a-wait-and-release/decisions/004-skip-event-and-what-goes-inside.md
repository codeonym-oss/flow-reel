# 004: A `skip` event in log version 5; hidden events are dropped; only actions and sounds go inside

**Date:** 2026-11-16 (ticket pass, Q4; the person answered "ok" to the recommendation)

**Question:** what does the reel record for a skip, and which words may run inside one?

**Decision:**
- **Event log:** a new `{ t, type: "skip", durationMs, label }` in capture time (`durationMs` is the real length cut,
  what `{duration}` shows). The log stays **version 5**: 0.4.0, which brings version 5, isn't released yet.
  `compare` checks a skip's `label` and start (within 150 ms), not its length, like `speedUp`.
- **Events inside a skip** (moves, clicks, typing, scrolls, sounds) are dropped from the log: nothing of them is seen.
- **Words inside a skip:** `comment`, `showFrame`, `speedUp` and `skip` throw, as for `speedUp`; `flash`, `zoomIn` and
  `zoomOut` throw too, standalone or chained (invisible, and a held zoom would leave a camera state nobody saw).
  Sounds are allowed and dropped (story decision 003).

- **Not chosen:** keeping hidden events moved onto the card's start (polish would draw a burst of clicks on it);
  dropping `flash` and zoom silently (a zoom held across the skip still needs special handling).

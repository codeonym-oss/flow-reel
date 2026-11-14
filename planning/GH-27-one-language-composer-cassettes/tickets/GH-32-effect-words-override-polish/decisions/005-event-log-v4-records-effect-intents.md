# 005: Event log version 4 records what each effect word asked for, and `autoZoom`

**Date:** 2026-11-14 (ticket pass, Q6; agreed: "ok")

**Question:** how does the event log (`events.json` in the reel) record effects?

**Decision:** **intents, as clicks are logged; the polish planner computes the geometry.** Version 4 adds a top-level
`autoZoom` and three event types:

```jsonc
{ "version": 4, "autoZoom": true, "events": [
  { "t": 1200, "type": "flash", "color": "#ffffff", "ms": 250 },
  { "t": 1800, "type": "frame", "image": "diagram.png", "sha256": "…", "durationMs": 3000, "fit": "contain", "background": "#000000" },
  { "t": 5000, "type": "zoom", "zoom": "in", "at": [960, 540], "bounds": { "x": 0, "y": 0, "width": 1, "height": 1 }, "scale": 1.333, "ms": 650 },
  { "t": 9000, "type": "zoom", "zoom": "out", "ms": 800 }
]}
```

A chained `zoomIn` records its element's point and box; a standalone one records the pointer (no `bounds`).
`flow-reel compare` and every reader take version 4 only, as with the earlier bumps in this story.

- **Why:** `events.json` alone describes the picture, so a reel can be re-rendered without the script; the framing
  rules stay in one place, the planner, and can change without changing the format.
- **Not chosen:** logging the computed crop (framing logic in the wrapper and the planner; a framing change becomes a
  format change); leaving `autoZoom` out of the log (two reels with the same log could differ in picture).

# 003: `showFrame` inserts its image into the video's timeline; holds and frames are both insertions

**Date:** 2026-11-14 (ticket pass, Q3; asked by the person for "the solid way to do it properly, not the
workaround"; agreed: "ok")

**Question:** how does `showFrame` fit into the video's timeline: does it pause the action or cover it?

**Decision:** **it is an insertion.** The timeline is the capture plus a list of insertions, each placed at a capture
frame: a **hold** (clones the frame before it, as today) or a **frame** (an image for N frames, scaled by `fit` on
`background`). The viewer sees the image, then the capture resumes on the exact frame it left.

- `await showFrame(image, ms, opts?)` is an action of its step: it waits for the app to settle, opens the step when a
  comment is queued, logs a `frame` event and returns at once, without waiting in real time.
- Insertions may fall anywhere, also inside a step. Every time (step start, action end, step end, events) moves
  through one mapping, `timeline.mapTime`, instead of a running offset that holds only at step ends allowed.
- A step's comment starts with its step and plays on over the image; the hold that lets a comment finish counts the
  inserted frames.
- The master is rendered from the timeline's segments (capture spans, cloned frames, image frames); polish draws on
  top as before, and draws no cursor, ripple or zoom over an image.

- **Why:** waiting while the app runs under a covering image breaks continuity (a toast, a spinner or a carousel has
  moved when the image ends) and spends real compose time on footage nobody sees; an insertion is what "show this
  image here" means, and one model for every insertion keeps one rule for how video time is built.
- **Not chosen:** the script waits and the image covers that span afterwards (the workaround above); the image
  covers the action while it runs (the action happens unseen).
- **Keeps:** decision 001 (`showFrame` is awaited, standalone only); GH-1 decision 012 (polish rendered in post from
  the event log).

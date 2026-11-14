# 007: `flow-reel compare` also checks the effects

**Date:** 2026-11-14 (ticket pass, Q8; agreed: "ok")

**Question:** how is "composing the same script twice gives the same effect timings" checked?

**Decision:** **`compare` checks the effects too.** Both reels must hold the same `flash`, `frame` and `zoom` events,
in the same order, with equal options and image hashes, each starting within 150 ms of its counterpart, and the same
`autoZoom`. Clicks, moves, typing, scrolls and sounds are not compared. On success it prints "Reels match (step
starts and effects within 150 ms)." The e2e test composes an effects fixture twice and runs `compare`.

- **Why:** a person can check the promise themselves, with the tool they already use for transcripts.
- **Not chosen:** a check in the e2e test only (users cannot run it); comparing the whole event log (pointer paths
  differ between honest composes).

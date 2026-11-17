# 005: Seven transitions into and out of every card

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how a card comes in and goes out?

**Decision:**
- `enter` and `exit` on every card, and in the brand: `fade` (400 ms, the default), `slide` (500), `wipe` (500),
  `zoom` (450), `blur` (500), `iris` (600) and `cut` (0).
- A transition plays inside the card's time, between the card and the app frame before it (in) or after it (out),
  with FFmpeg's `xfade`.

- **Why:** a few named, tested transitions cover what a product video needs; inside the card's time, the timeline stays as it is.
- **Not chosen:** free durations and easings per transition (more to check and teach for little gain).

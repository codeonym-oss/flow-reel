# 009: A watcher that falls behind gets only the newest picture

**Date:** 2026-11-26 (grilling, Q7; agreed: "1")

**Question:** what happens when a browser can't keep up with the live picture?

**Decision:** **each watcher holds at most one picture waiting to be sent. A newer picture replaces it; the older one is
dropped. Journal events are never dropped.**

- **Why:** a slow or hidden tab never slows the recording or grows memory; it only shows fewer pictures a second.
- **Accepted cost:** a slow tab's live picture is jerky.
- **Not chosen:** a short queue that pauses the grab (a slow watcher would hold back the recording's second grab); the
  browser asking for each picture (a round trip per picture, fewer pictures on a busy computer).

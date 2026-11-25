# 018: Capture stops while a run is held, for pauses and interrupts alike

**Date:** 2026-11-25 (grilling; agreed: "A, use the interrupt's way for both")

**Supersedes 012.**

**Question:** does a pause keep recording, when an interrupt must not?

**Decision:** **one mechanism: capture stops while a run is held, and restarts after it as another file with its own
timing marker.** The composer joins the files.

- **Why:** one mechanism to build and test; nothing grows while a run is held; what a person types during an interrupt is
  never recorded.
- **Accepted cost:** the timing marker flashes on the app after each hold; the flash is cut from the reel. The picture
  can jump where the files join.
- **Not chosen:** pauses cut from a recording that keeps running (two mechanisms, and a long pause grows the file).
- **Open:** whether the page's clock is frozen during a pause; it keeps running during an interrupt.

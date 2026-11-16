# 004: Sounds, flash and zoom are allowed inside speedUp

**Date:** 2026-11-16 (ticket pass, Q4; the person answered "ok" to the recommendation)

**Question:** story decision 006 left open whether sounds and flash/zoom may be used inside `speedUp`'s callback.

**Decision:** **allow both.** Sounds play at their own speed (story decision 003) at their mapped video time; flash and
zoom are retimed like any event (decision 003), so a zoom runs at the stretch's pace. Only the words that insert time
or nest throw: `comment`, `showFrame`, `speedUp`, `skip`.

- **Why:** they are actions and are timed correctly; a rushed zoom is visible in the reel and the writer can move it
  out of the stretch.
- **Not chosen:** sounds only (one more rule); neither (a sped-up click loses its sound).

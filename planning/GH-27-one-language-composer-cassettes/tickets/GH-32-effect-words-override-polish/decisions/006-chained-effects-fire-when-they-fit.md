# 006: A chained effect fires at the moment that suits it

**Date:** 2026-11-14 (ticket pass, Q7; agreed: "ok")

**Question:** when exactly does each chained effect fire?

**Decision:**

- **`zoomIn`** starts when the pointer starts moving to the element, so the element is framed when the action lands.
  For an action without a pointer move (the uncovered ones, such as `press`), it starts with the action and frames
  the element's box.
- **`flash`** fires when the action happens, with a chained sound.
- **`zoomOut`** fires after the action finishes.

- **Why:** a zoom that starts at the click lands after it; "zoom out" after an action reads as "do it, then pull
  back".
- **Changes:** decision 001's "a chained word fires when its element's action happens", for the zoom words only.
- **Not chosen:** every chained word at the action (a chained zoom-in always lands late); effects standalone only
  (`zoomIn` could not frame the element about to be used).

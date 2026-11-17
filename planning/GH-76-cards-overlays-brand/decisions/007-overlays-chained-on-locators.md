# 007: Overlays chain on locators and last until the step ends

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how a script points at something in the app?

**Decision:**
- `await locator.callout(text, { detail? })` and `await locator.highlight()` spotlight an element; `await
  lowerThird({ title, subtitle? })` shows a title bar.
- Each shows from its moment until its step ends (the next comment), holds included, so it lasts as long as the
  comment about it. A callout and a highlight are drawn on the app and move with the camera; a lower third stays put.

- **Why:** they know what they point at, in the shape scripts already use (`locator.comment()`), and need no timing.
- **Not chosen:** overlays as cards (the app would stop); explicit start and end words (more to write for the common case).

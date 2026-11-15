---
status: open
from: agent
found-while: GH-6
resolved-by:
---

# A held zoom eases out before a comment's hold, at the end and between scenes

Seen while composing the plugin's saved-views example with runtime 0.2.0 (events and stills in the GH-6 trial):

- **At the end of a script:** `compose.ts:83-86` logs the automatic ease-out of a zoom still held at
  `recording.now()`, when the script's actions end. The hold that lets the last comment finish is inserted after
  that, so the camera widens while the last comment is still being spoken (the example's payoff link was framed for
  about 0.3 s, then the last 2.5 s of its comment played on the wide shot).
- **Between scenes:** a standalone word written after a step's last action, even after the next `comment(…)`, is
  logged before that step's hold (the timeline maps it into the settled window). `comment("…"); zoomOut();` before
  the next scene's first action ends the previous scene's zoom ~4.7 s before its comment finished.

README's "a zoom still held when the script ends eases out" and "zoomIn holds the camera until zoomOut" read as if
the zoom lasts to the video's end and through the comment. The plugin teaches the workaround (chain `.zoomOut()`
on the next scene's first action; end on a click or the wide shot), so nothing is blocked.

A fix would place the end-of-script ease-out at the video's end (after the last hold), and either place standalone
words called after a `comment()` at the start of that comment's step, or document the current rule in the README.
It is a runtime change (`fix:`), with a test in `test/unit/timeline.test.ts` or the effects e2e.

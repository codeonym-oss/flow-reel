# 002: `comment()` is not awaited; the next action waits for the app

**Date:** 2026-11-14 (ticket pass, Q2; agreed: "ok")

**Question:** does opening a step block the script (`await comment(…)`), or not?

**Decision:** **not awaited.** `comment(text)`, standalone or chained, returns at once and marks that a step opens.
The next action on the page waits for the app to stop loading and settles before it acts, as steps do today; the
next comment, or the end of the script, closes the step. Two comments with no action between them give a step with
no action: the picture is held for the length of the line, which is how a script holds the picture.

- **Why:** one rule for both forms; a forgotten `await` cannot become a silent timing bug.
- **Not chosen:** `await comment(…)` (agents forget it; a chained comment could not be awaited on its own).

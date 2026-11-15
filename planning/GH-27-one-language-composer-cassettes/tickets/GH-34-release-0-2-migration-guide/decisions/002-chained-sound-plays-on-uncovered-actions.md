# 002: A chained sound plays on uncovered actions too, fixed before 0.2.0

**Date:** 2026-11-15 (ticket pass, Q2; agreed: "ok")

**Question:** a sound chained on an action the wrapper can't animate (`press`, `tap`, `focus`, …) never plays,
silently, while chained effects on the same actions do (noted in GH-32's `impl.md`). Fix it before 0.2.0?

**Decision:** **fix it in this ticket.** In `wrap.ts`'s branch for uncovered locator actions, the chained sound plays
when the action happens, with the flash (GH-32 decision 006). A unit test chains a sound on `press`.

- **Why:** 0.2.0 is the first release with the word; a documented word that silently does nothing is a bug users
  would meet first.
- **Not chosen:** a follow-up for 0.2.1 (ships a known silent bug); a separate `fix:` ticket before the release (the
  same ten lines, plus an issue and a pull request).

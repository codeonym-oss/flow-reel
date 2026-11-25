# 009: One lock per computer for heavy work: a recording, a render or a local voice

**Date:** 2026-11-25 (grilling, Q8; agreed: "2, with one heavy work lock")

**Question:** what may run at the same time?

**Decision:** **one lock per computer, held by a recording, a render or a local voice; a cloud voice doesn't take it.** A held
run captures nothing, so it gives the lock up and takes it back before capture restarts, waiting for a render in progress.
Another recording still can't start while a held run's browser is open, so epic 031's "one recording at a time" stands.

- **Why:** a render uses most of the CPU, and a compose fails when its capture falls more than 3 % behind real time.
- **Not chosen:** one run at a time from start to end (a cloud voice or a held run would block the queue); only recordings
  exclusive (some would fail, depending on the computer).

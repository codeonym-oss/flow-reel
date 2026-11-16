# 005: A speed-up is a `speed` event in the event log, which becomes version 5

**Date:** 2026-11-16 (ticket pass, Q5; the person answered "ok" to the recommendation)

**Question:** where does a reel record each sped-up stretch and its factor?

**Decision:** **a new event** `{ t, type: "speed", factor, durationMs }` in capture time, in the reel's event log,
which moves to **version 5**. `compare` adds `speed` to its effects: same order, same factor, starts within 150 ms.
The transcript is unchanged. Reels composed before 0.4 must be composed again, as with every log version so far.

- **Why:** the pattern every other effect (flash, frame, zoom) follows; `compare` sees speed-ups.
- **Not chosen:** a separate `speed.json` in the reel (a second file to keep in step, invisible to `compare`); a
  `speed-start`/`speed-end` pair (must be matched up again everywhere it's used).

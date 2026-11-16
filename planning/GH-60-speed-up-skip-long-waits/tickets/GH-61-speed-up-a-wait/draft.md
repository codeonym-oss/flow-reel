# Speed up a wait in a reel, with a badge showing the factor

## Problem

A reel plays every wait in real time, so a 60-second agent reply is 60 seconds of video where little changes.

## Change

- A new awaited effect word, `speedUp(factor, fn)`: the stretch while `fn` runs plays `factor` times faster in the
  reel, with a fixed "▶▶ ×N" badge in a corner that fades in and out (story decisions 005, 007).
- The renderer learns to change a stretch's length on the final timeline; the transcript, captions, event log and
  sounds follow it. Skip (the next ticket) reuses this.
- A comment spoken over the stretch keeps its normal speed; if it outlasts the shortened stretch, the last frame
  holds as today (decision 003). Only actions run inside `fn` (decision 006).
- README, `CONTEXT.md` (if a new term is needed) and the public types.

## Settled in the ticket pass

- Factors: any number above 1 and at most 16, fractions allowed (decision 001).
- Text is drawn with bundled Noto fonts through ffmpeg's `drawtext`; the badge sits top-right with 200 ms fades
  (decisions 002, 006).
- Durations inside a stretch are retimed by mapping both ends (decision 003).
- Sounds, flash and zoom are allowed inside `fn`; `comment`, `showFrame` and nesting throw (decision 004).
- A `speed` event in the event log, now version 5; `compare` checks it (decision 005).
- Frames are dropped, keeping source frame `floor(i × factor)` (decisions 007, 008).

## Done when

- A script waiting about 60 s for a slow reply, wrapped in `speedUp(4, …)`, composes into a reel where that wait
  lasts about 15 s with the badge showing, and the comment before it is spoken whole.
- Transcript windows and captions line up with the final video (`verify` passes).
- Two composes of the same script give the same structure (`compare` passes).
- `comment()`, `showFrame` or a nested `speedUp` inside `fn` throws a clear error.
- Unit tests for the retiming and the word's checks; an e2e compose with a slow fake endpoint.

# 001: The journal keeps every event; only the ones that change the state are flushed to the disk one by one

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **progress goes in the journal too, as events that change no state. Every other event is on the disk when
`append` returns.** A run's journal exists from the moment its folder does, with its first entry.

- **Why:** watching is reading one file, for a live run and a finished one alike (011). Losing the last progress lines in a
  power cut loses nothing.

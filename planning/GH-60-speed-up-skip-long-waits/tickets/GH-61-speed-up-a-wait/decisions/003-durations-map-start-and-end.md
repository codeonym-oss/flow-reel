# 003: Event durations are retimed by mapping their start and end through the timeline

**Date:** 2026-11-16 (ticket pass, Q3; the person answered "ok" to the recommendation)

**Question:** inside a sped-up stretch, what happens to event durations (`durationMs`, `charDelayMs`, zoom `ms`)?

**Decision:** **map both ends.** A retimed duration is `mapTime(t + d) − mapTime(t)`, and `charDelayMs` is scaled by
the same ratio as its event's duration. Events entirely outside a stretch keep their durations exactly.

- **Why:** polish then animates over the same span the picture shows; one rule for every event, correct for an event
  that crosses a stretch's edge.
- **Not chosen:** dividing by the factor when the event starts inside a stretch (wrong across an edge); leaving
  durations alone (effects lag the sped-up picture).

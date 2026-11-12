# 002: Implement clicks and typing first

**Superseded by 003.**

**Date:** 2026-11-11 (ticket pass, Q2; agreed: "ok" to the recommendation to wire clicks and typing first)

**Question:** should GH-8 also introduce explicit success, error and navigation cues?

**Decision:** **GH-8 implements automatic click and per-character typing sounds only**, using the existing retimed event log. Keep the broader audition library available for selecting future action cues. Do not add semantic-event detection or a script API for these cues in this ticket.

- **Why:** click and typing events already exist; this completes the planned ticket without widening its event model.
- **Not chosen:** adding explicit success/error/navigation cues now, which would require new API and event support.

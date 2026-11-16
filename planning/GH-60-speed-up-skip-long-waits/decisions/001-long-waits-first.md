# 001: Long waits are the problem this shaping solves first

**Date:** 2026-11-16 (shaping, Q1; the person answered "yes" to the recommendation)

**Question:** of the needs raised (long waits, several scenarios per file, failure handling), which one drives this
work?

**Decision:** **long waits that make reels drag** (an agent replying, a build, an upload): speed-up, skip and pause
screens come first.

- **Why:** the need came straight after "can a script wait for an agent to finish?", it is what every viewer sees,
  and it fits the existing timeline, which already inserts time (`showFrame`, speech holds).
- **Left for later:** several scenarios per file (it changes GH-27 decision 010, one file one reel) and failure
  handling (plain `try/catch` already lets a script go on) are shaped separately, after this.

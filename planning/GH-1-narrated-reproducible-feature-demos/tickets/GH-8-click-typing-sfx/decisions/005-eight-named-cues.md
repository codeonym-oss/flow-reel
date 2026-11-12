# 005: Eight named action cues

**Date:** 2026-11-11 (ticket pass, Q4; agreed: "ok")

**Question:** which additional cues should scripts expose?

**Decision:** **expose `success`, `error`, `notification`, `open`, `close`, `toggle`, `back` and `select`** as explicit cues, alongside automatic click and typing sounds. Each name maps to a bundled default asset. Do not expose arbitrary library filenames as the script API in GH-8.

- **Why:** these cover common UI feedback and keep scripts independent of the chosen audio files.
- **Not chosen:** exposing the entire downloaded library by filename, which would bind scripts to asset implementation details.

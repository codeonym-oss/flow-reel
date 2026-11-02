# 009: "The same video" means same structure, same audio, step starts within ±150 ms

**Date:** 2026-11-02 (global pass, Q7, raised by a side agent's note; agreed: "ok")

**Supersedes 003** (its done check only; the rest of 003 stands).

**Question:** a live browser recording is never byte-identical twice; what counts as "the same script gives the same
video"?

**Decision:** **two runs are the same when** they have the same steps in the same order, the same transcript text and
captions, the same audio clips, and every step starts within **±150 ms** of the other run, all read from
`transcript.json`. The runner removes the main sources of variance: fixed viewport and device scale,
`prefers-reduced-motion`, a fixed clock and seed, and a network-idle wait before each step.

- **Why:** measurable from `transcript.json` alone; ±150 ms is below what a viewer notices in narration sync and wide
  enough for normal page-load jitter.
- **Not chosen:** structure only (drift goes unnoticed); perceptual frame hashing (flaky with live data, costlier; a
  possible later story).

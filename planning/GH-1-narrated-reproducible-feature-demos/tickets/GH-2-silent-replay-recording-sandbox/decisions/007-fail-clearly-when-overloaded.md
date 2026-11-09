# 007: A recording on an overloaded machine fails with a clear error; no fallback or retry

**Date:** 2026-11-09 (building, raised by a review of failed e2e runs; agreed: "ok")

**Question:** two of three e2e runs failed decision 005's real-time check while other work on the machine held the
load average at 11-13 on 8 threads. Should the runner capture differently, fall back, retry, or fail?

**Decision:** **keep decision 005's capture and fail, with an error that says how far the capture fell behind and
what to do (close other apps, use a bigger machine).** The GPU encoder in the story's `master-4k-option` follow-up is
the fix for heavy load.

Measured: CPU used by ffmpeg while recording 6 s of Chromium scrolling an animated page at 1440p, load average 7-9,
AMD Ryzen 5 3500U (4 cores, 8 threads), two rounds each:

| Master capture | CPU | Disk for 6 s |
|---|---|---|
| x264 ultrafast CRF 10 (decision 005) | 2.27 cores | 20 MB |
| utvideo yuv420p | 1.93 cores | 154 MB |
| utvideo gbrp | 3.08 cores | 292 MB |

Every setting kept up (6.00 s of video for 6 s). A live capture runs at 1× at most, so decision 005's "0.99×" means
it kept up, not that it was at its limit; the headroom is in the CPU it uses.

- **Why:** the capture needs about 2.3 cores, which an idle 4-vCPU CI runner has; failures came only when the machine
  was overloaded, where any setting drops frames.
- **Not chosen:** capturing with utvideo and compressing afterwards (15 % less CPU for 7-8× the disk and about 7 s of
  compressing per 6 s recorded); falling back to a 1080p master after a failure (two configurations, zooms not sharp,
  and the time doubles on each failure); retrying once (helps with spikes only).
- **Cost accepted:** on an overloaded machine, recording fails until the load drops.

# 001: Record with Xvfb + ffmpeg x11grab into a 4K near-lossless master

**Date:** 2026-11-02 (ticket pass, Q1; agreed: "ok")

**Question:** which recorder captures the video, given that polish (zoom, follow cursor) is rendered in post
(story decision 012)?

**Decision:** **headed Chromium in kiosk mode on a 3840×2160 Xvfb display (device scale 2), captured by ffmpeg
`x11grab` at a constant 30 fps into a near-lossless H.264 master** (CRF ~10). The master is what later tickets zoom
into and downscale to 1080p. Step and event timestamps use one monotonic clock whose origin is ffmpeg's first frame.

- **Why:** a sharp master to zoom into, constant frame rate for smooth follow-cursor motion, and one measurable
  clock origin for decision 009's ±150 ms.
- **Not chosen:** CDP screencast (frames only on change, uneven pacing in animations); Playwright `recordVideo`
  (fixed modest WebM quality, blurs when zoomed).
- **Costs accepted:** window management so no browser chrome shows; ~1–2 GB per minute of master; more CPU.

# 001: Audition web-sourced sound effects across UI actions

**Date:** 2026-11-11 (ticket pass, Q1; agreed: "lets fetch some SFX from the web!"; expanded: "please do get me a bunch of effects we can use for different events and actons , like a pro designer SFX !!!")

**Question:** synthesized project-owned taps or downloaded sound assets, and how broad should the selection be?

**Decision:** **retrieve a broad web-sourced audition library** covering clicks, typing candidates and other UI actions. Preserve source and licence evidence. The person wants a polished sound palette with choices, rather than generated placeholder taps.

- **Why:** auditioning a coordinated family gives the person concrete choices for professional sounding demos.
- **Not chosen:** synthesized-only assets.
- **Evidence:** `../sfx-library/README.md`, the searchable browser, manifest and included licences. Kenney Interface Sounds and UI Audio are CC0 on the official pages; retrieved through a pinned mirror after official downloads returned HTTP 403.
- **Still to settle:** default click/typing assets, mixing behaviour, and whether semantic actions beyond clicks/typing belong in GH-8. This decision authorizes collecting candidates, not inventing detection for events the runner does not log.

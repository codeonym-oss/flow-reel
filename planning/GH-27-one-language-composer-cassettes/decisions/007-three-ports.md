# 007: The composer has three ports: integration, voice and cassette store

**Date:** 2026-11-14 (shaping, Q6; agreed: "ok")

**Question:** which seams of the composer are ports?

**Decision:** **three ports.**

- **Integration:** the E2E tool that runs a script (Playwright now, Cypress later).
- **Voice:** turns a comment into speech (local now, cloud later with the cassette cache; decision 005).
- **Cassette store:** where a cassette is written and its cache read (a folder now).

Capture, video rendering, sound mixing and captions stay plain modules inside the composer; each becomes a port
only when a second implementation appears.

- **Why:** each port matches something users choose or the determinism promise depends on; a port with one adapter
  forever is indirection, which the project's coding rules forbid.
- **Not chosen:** ports for every piece (about five single-adapter interfaces, no user-visible gain); integration
  and voice only (storage changes would later touch the core).

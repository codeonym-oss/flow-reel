# 006: flow-reel is its own repo and image, separate from design-skills

**Date:** 2026-11-02 (shaping, Q4; agreed: "yes!")

**Question:** extend design-skills' `ds` image and `screen-recording` skill, or build separately?

**Decision:** **separate:** `codeonym-oss/flow-reel`, its own image. It may reuse ffmpeg patterns from design-skills.

- **Why:** `screen-recording` assumes OBS on the person's own desktop; flow-reel records headlessly with a browser
  and TTS — a different image with different contents and release cycle.
- **Not chosen:** a new skill in design-skills (bloats the `ds` image with Chromium, Playwright and a TTS model).

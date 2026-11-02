# 003: v1 is one command that writes a narrated MP4, captions and a timed transcript

**Superseded by 009** (the done check). **Superseded by 012** (polish now in this story).

**Date:** 2026-11-02 (shaping, Q3; agreed: "yes we will start with 1 for now!")

**Question:** what does done look like for the first version?

**Decision:** **one command, one file:** `flow-reel record demo.ts` writes an MP4 with a TTS voice, SRT/VTT captions
and `transcript.json` (per-step timing). Done when the same script gives the same video twice, and no narration clip
runs into the next step (measured: step start timestamps vs clip durations).

- **Why:** that is the core promise; everything else builds on it.
- **Not chosen for now:** posting previews on PRs (forge APIs, size limits) and polish (zoom on click, cursor
  highlight, intro/outro cards). Each is a later story.

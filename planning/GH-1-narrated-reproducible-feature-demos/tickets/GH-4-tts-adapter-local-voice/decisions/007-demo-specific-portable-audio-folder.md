# 007: Store clips beside the transcript in a demo-specific audio folder

**Date:** 2026-11-10 (ticket pass, Q7; agreed: "ok")

**Question:** keep audio beside the transcript or inside the ignored work folder?

**Decision:** **`demo.ts` produces `demo.audio/000.wav` beside `demo.transcript.json`.** Each step's `audio.file`
is relative to the transcript directory, for example `demo.audio/000.wav`. Demo-specific folders prevent different
scripts in one directory from sharing a generic `audio/` namespace.

- **Why:** the transcript and referenced clips can be copied together for GH-5 and reproducibility checks.
- **Not chosen:** `.flow-reel/demo/audio/`, which makes referenced output depend on an ignored intermediate folder;
  or a shared `audio/` folder, which collides between demos.

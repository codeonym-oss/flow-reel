# Hold each step for its voice clip, mux the audio, and check sync and reproducibility

## Problem

Voice and video are produced separately; nothing yet makes the voice fit each step, or proves two runs are the same.

## Change

- Narration is synthesised before recording, so the runner knows each clip's length and holds each step until its
  clip ends; `endMs` records the held end (decision 011).
- The clips are placed at each step's `startMs` and muxed into `demo.mp4`.
- A sync check: no clip runs into the next step.
- A check comparing two `transcript.json` files by decision 009's rule (e.g. `flow-reel compare a.json b.json`).

## Out of scope

Cursor, zoom and SFX (the next tickets); PR delivery (a later story).

## Done when

- `flow-reel record demo.ts` writes a narrated MP4, captions and transcript in one command (decision 003).
- The sync check passes on the sample demo, and two runs compare as the same under decision 009.

## For the ticket pass

- Hold strategy: wait after the action, or start the clip with the action and wait for whichever ends last.
- Loudness normalisation of the voice track.
- Whether the comparison is a CLI command, a test helper, or both.

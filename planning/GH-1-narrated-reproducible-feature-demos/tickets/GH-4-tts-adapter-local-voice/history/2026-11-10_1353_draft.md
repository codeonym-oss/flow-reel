# Voice narration through a TTS adapter with a local default voice

## Problem

Captions alone are not a narrated demo; the voice must work offline, in CI, with no key (decision 004).

## Change

- A TTS adapter interface in `flow-reel`: text in, an audio clip and its duration out.
- A local default voice in the image, called as a subprocess (decision 008).
- Each step's narration is synthesised to `audio/NNN.wav`; `transcript.json` gets `voice` and each step's `audio`
  with `durationMs` and `sha256` (decision 011).
- A cloud adapter can be selected with a key; the local one stays the default.

## Out of scope

Holding steps for their clip and muxing audio into the video (ticket 4).

## Done when

- Synthesising the sample demo's narration twice with the local voice gives identical `sha256` per clip.
- It runs with the network off.

## For the ticket pass

- Kokoro or Piper: quality, image size, CPU speed, licence.
- The adapter's interface, and which cloud adapter (if any) ships first.

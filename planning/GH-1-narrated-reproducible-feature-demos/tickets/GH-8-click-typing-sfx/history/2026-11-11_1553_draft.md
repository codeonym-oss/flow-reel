# Add click and typing sound effects mixed under the voice

## Problem

A silent cursor feels lifeless; clicks and typing without sound read as a slideshow (story decision 012).

## Change

- Click and key sounds placed at each `click` and typed character's time in `events.json` (story decision 013),
  mixed under the voice track with ducking so narration stays clear.
- Bundled, licence-clean sound assets; on by default, `--no-sfx` to turn them off.

## Out of scope

Background music.

## Done when

- The sample demo has a click sound within one frame of every ripple, and typing sounds per character.
- The voice stays intelligible: the mix keeps SFX at least ~12 dB under the voice, and loudness meets the target
  the voice ticket set.

## For the ticket pass

- Sound sources and their licences.
- Ducking and loudness settings.

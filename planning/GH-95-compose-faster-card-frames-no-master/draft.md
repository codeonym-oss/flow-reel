# Compose faster: quicker card frames and no master file

## Why

A reel with five cards took 134 s to compose without the voice; the cards alone took about 70 s. A prototype
(local branch `proto/compose-speed`, commit beb5af8) measured where that time goes and which fixes are safe:

| Change | Cards reel (s) | Plain reel (s) |
|---|---|---|
| before | 134.1 | 37.3 |
| all safe fixes together | 76.9 | 31.0 |

A warning for steps recorded with too few frames was planned here too and dropped (decision 002): the choppy
animation that prompted it comes from `prefers-reduced-motion`, which the composer sets, not from a busy machine.

## What it does

- **Fast card screenshots:** the card painter shoots over CDP with Chromium's fast PNG encoder, at the device scale
  (same pixels, about half the time per frame).
- **Still frames are reused:** when nothing moved and nothing in the page changed since the last frame, the card
  painter writes the last frame again instead of shooting it.
- **Frame counts from the header:** the frame count of an MP4 is read from its header, not by decoding the file.
- **No master file:** the cuts, holds and cards go straight into the delivery encode; `work/master.mp4` is no longer
  written (`master.json` stays).
- **One decode for a card's backdrop:** both app frames around a card come from one ffmpeg call.

## Not part of it

- Drawing several cards at once: the prototype showed stale frames under load.
- Recording frame by frame on a stepped clock: it would break real-time waits on a live backend.
- A voice cache shared between reels, and the image split into a full and a cloud tag.
- Whether reels keep `prefers-reduced-motion` (story GH-1 decision 009): a question for its own ticket.

## Done when

- The card tests pass with unchanged frames.
- The render tests pass with the delivery checked instead of the master.
- A repeated paint, three composes at once, gives the same frames; a canvas page is shot on every frame.
- CI is green.

# Narrate steps in the transcript and write SRT/VTT captions

## Problem

After ticket 1 the video has timings but no words: a viewer can't tell what each step shows.

## Change

- Each step's `narration` (the first argument of `step()`) goes into `transcript.json` (decision 011).
- `demo.srt` and `demo.vtt` are written from the steps' `narration`, `startMs` and `endMs`.

## Out of scope

Voice (tickets 3-4); burned-in captions (polish, a later story).

## Done when

- The sample demo writes captions that play in sync in a standard player (mpv, VLC, a `<video>` with `<track>`).
- Two runs give identical caption text and step order.

## For the ticket pass

- Long narration: one cue per step, or split into cues by length?
- Escaping and line breaking in SRT/VTT.

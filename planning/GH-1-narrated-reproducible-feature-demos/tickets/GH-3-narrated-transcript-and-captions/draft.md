# Narrate steps in the transcript and write SRT/VTT captions

## Problem

After ticket 1 the video has timings but no words: a viewer can't tell what each step shows.

## Change

- Each step's original `narration` (the first argument of `step()`) goes into `demo.transcript.json` unchanged
  (story decision 011). Version 1 transcripts without narration remain valid.
- `demo.srt` and `demo.vtt` are written beside the script and MP4, from the final calibrated `startMs` and `endMs`.
- One cue per captioned step, with no splitting or added reading time (ticket decision 001).
- Caption whitespace is normalized and players wrap the text; the transcript retains original whitespace
  (decision 002). Blank narration and zero-duration steps produce no cue but stay in the transcript (decision 003).
- Caption text escapes `&`, `<` and `>`. WebVTT displays literal text; some SRT players display escape sequences.
  This compatibility limit is documented (decision 004).

## Out of scope

Voice, step holds and audio muxing (GH-4/GH-5); burned-in captions; cursor/zoom polish; caption styling options.

## Done when

- The sample demo writes captions that play in sync in a standard player (mpv, VLC, a `<video>` with `<track>`).
- Two runs give identical caption text and step order.
- New recordings preserve original narration on every transcript step, and each emitted cue uses that run's
  final step boundaries. Recording timing stays unchanged.
- Tests cover whitespace, escaping, Unicode, timestamp boundaries, skipped cues, old transcripts and empty output.
- Generated WebVTT loads in a real browser with correct decoded text and times; generated SRT parses with correct
  times, and its player-dependent escaping limitation is documented.

## Decisions and implementation

Ticket decisions 001-004 settle cue boundaries, wrapping, skipped cues and escaping. See `impl.md` for the build
steps, checks and compatibility risks.

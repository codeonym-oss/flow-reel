# 004: Escape caption text and document SRT player differences

**Date:** 2026-11-10 (GH-3 ticket pass, Q4; recommended option 1, agreed: "ok")

**Partly supersedes 002:** literal text is guaranteed by WebVTT escaping; SRT players may display the escape sequences.

**Question:** how should markup-like narration be handled when SRT players do not consistently decode escapes?

**Decision:** after normalizing caption whitespace, escape `&`, `<` and `>` as `&amp;`, `&lt;` and `&gt;` in both
formats. Escape original characters once, preserving existing entity-looking input as literal text in WebVTT.
Keep original narration unchanged in the transcript. Document that some SRT players display these sequences rather
than decoding them; do not promise identical literal rendering across all players.

- **Why:** captions do not emit raw tags; WebVTT can represent the original text, and SRT has a clear, documented
  compatibility limit without changing the script API or rejecting narration.
- **Not chosen:** raw SRT text (players may interpret tags as styling).
- **Cost accepted:** SRT captions containing special characters may show escape sequences in some players.

## Sources checked

- [WebVTT syntax and cue text](https://www.w3.org/TR/webvtt1/#syntax): cue text supports character references;
  encoding `>` also prevents a raw `-->` inside a cue payload.
- [Library of Congress SRT description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000569.shtml):
  describes the format's structure and player-dependent formatting.
- [FFmpeg subtitle decoder](https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/htmlsubtitles.c): handles tags
  and otherwise copies text; HTML entity decoding must not be assumed for SRT playback.

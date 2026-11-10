# 002: Players wrap plain caption text; the transcript preserves narration

**Partly superseded by 004** (SRT players may display escape sequences instead of the literal characters).

**Date:** 2026-11-10 (GH-3 ticket pass, Q2; recommended option 1, agreed: "ok")

**Question:** should captions use player-controlled wrapping or fixed-length line breaks?

**Decision:** normalize caption whitespace into a single line and let the player wrap it for its display. Preserve
the original narration unchanged in the transcript. Emit narration as literal caption text, using the format's
escaping rules so markup-like input is not interpreted as styling or cue structure.

- **Why:** wrapping adapts to the player's available width without inventing fixed character limits or altering the
  narration stored for later voice synthesis.
- **Not chosen:** inserting line breaks at a fixed length (extra formatting rules, awkward on smaller displays).
- **Cost accepted:** visual line breaks can differ between players and display sizes.

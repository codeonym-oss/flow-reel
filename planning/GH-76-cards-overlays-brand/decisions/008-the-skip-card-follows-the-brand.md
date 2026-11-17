# 008: The skip card follows the brand, as a clock or a bar

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how the skip card looks?

**Decision:**
- The skip card is drawn like the other cards, in the brand's theme, over the blurred last frame:
  `skip(fn, { label?, style: "clock" | "bar" })`, a centred panel with a clock ring (the default) or a bar along
  the bottom. `label` still replaces the words; `{duration}` still shows the length cut.
- This replaces GH-62 decision 007's fixed look; its duration rules (GH-62 decision 003) stay.

- **Why:** the skip card would otherwise be the one card that doesn't match the reel.
- **Not chosen:** keeping the FFmpeg-drawn card (two looks in one reel).

# 007: The badge and the card have a fixed look; skip's text can be replaced

**Date:** 2026-11-16 (story, Q3; the person answered "ok" to the recommendation)

**Question:** how much can a script change the speed-up badge and the skip card?

**Decision:**
- **Badge:** fixed: "▶▶ ×4" (the factor) in a corner, fading in and out; no options. A factor reads the same in every
  language.
- **Card:** the last frame before the stretch, dimmed, with "⏭ 38 s skipped" (the real length cut) for about 1.5 s,
  longer while a comment is still being spoken (decision 003). One option, `label`, replaces the text:
  `skip(fn, { label: "38 s plus tard" })`.

- **Why:** the look matches the automatic polish (cursor, ripple), which has no options; the only text on screen can
  follow the reel's language, which cloud voices make likelier to be other than English.
- **Not chosen:** no options at all (an English card in a French reel); full styling (many options to check and
  teach for little gain).
- **Ticket pass:** the badge's corner, the fade lengths, whether the label can include the cut length.

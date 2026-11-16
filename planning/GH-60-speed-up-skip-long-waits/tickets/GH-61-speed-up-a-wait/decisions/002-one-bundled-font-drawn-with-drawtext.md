# 002: The badge is drawn with one bundled open-licensed font, through ffmpeg's drawtext

**Date:** 2026-11-16 (ticket pass, Q2; the person answered "yes" to the re-asked recommendation)

**Question:** how is the badge's text ("▶▶ ×N") drawn onto the video?

**Decision:** **bundle one open-licensed font in the repo** (Noto Sans, OFL licence, with its licence file) and draw
the badge with ffmpeg's `drawtext` using that file. GH-62's skip card uses the same font, so the story has one way of
drawing text, and its look is fixed by the repo, not by the image.

- **Why:** GH-62's card shows a label in any language (`label: "38 s plus tard"`, story decision 007), which needs a
  real font with accents; drawing the badge from pixel data would leave the story with two ways of drawing text.
- **Reopened:** the person first answered "ok" to pixel-drawn glyphs; that recommendation missed GH-62's label, so
  the question was asked again before anything was saved.
- **Not chosen:** pixel-drawn badge now and a font for the card later (two ways of drawing text); the base image's
  fonts (an image update could change the look).
- **Limits:** Noto Sans covers Latin, Greek and Cyrillic; CJK or Arabic labels would need more fonts later. If
  "▶" or "⏭" are missing from the font, the implementation draws them another way or picks a Noto file that has them.

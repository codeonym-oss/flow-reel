# 002: The options of each effect word and their defaults

**Date:** 2026-11-14 (ticket pass, Q2; agreed: "ok")

**Question:** which options does each effect word take (decision 001), and what are the defaults?

**Decision:**

| Word | Options (defaults) |
|---|---|
| `flash(opts?)` | `color: "#ffffff"` (hex `#rrggbb` only), `ms: 250` (fade-out length) |
| `showFrame(image, ms, opts?)` | `fit: "contain" \| "cover"` (`"contain"`), `background: "#000000"` (fills the bars when contained) |
| `zoomIn(opts?)` | `scale: 4/3` (from 1 to 2; above 4/3 the picture softens), `ms: 650` (ease-in length) |
| `zoomOut(opts?)` | `ms: 800` (ease-out length) |

`scale` is the most a zoom enlarges: a chained zoom on an element too large for it zooms less, so the element stays
in frame. A bad value throws at the call with a clear message, as an unknown sound does.

- **Why:** the defaults are today's automatic zoom timings, so an explicit zoom looks like an automatic one; 4/3 is
  the sharpest zoom the capture allows (it is recorded at device scale 4/3).
- **Not chosen:** `showFrame` without `fit` and `background` (always contained on black); more options such as a
  zoom target point, flash opacity or easing curves (no one has asked for them).

# 003: The card lasts at least 1.5 s, or until the comment ends, and fades over 200 ms

**Date:** 2026-11-16 (ticket pass, Q3; the person answered "ok" to the recommendation)

**Question:** how long does the card show, and how does it look?

**Decision:**
- **Length:** at least 1.5 s; if the step's comment is still being spoken when the card starts, the card lasts until
  the comment ends plus the usual 200 ms tail. The card takes the place of the step's hold.
- **Look:** the frame before the wait, dimmed to 40 % brightness; the text centred, white, 6 % of the video height,
  in the bundled Noto fonts (GH-61 decision 002).
- **Fades:** the dimming and the text fade in and out over 200 ms each, inside the card's time.
- **Polish:** no cursor, ripple or zoom over the card, as over a `showFrame` image.

- **Not chosen:** a fixed 1.5 s with the comment's rest held after the wait (the card vanishes mid-narration); a
  hard cut without fades.

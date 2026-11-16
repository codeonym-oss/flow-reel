# 006: The badge sits top-right, sized to the video, with 200 ms fades

**Date:** 2026-11-16 (ticket pass, Q6; the person answered "ok" to the recommendation)

**Question:** where does the "▶▶ ×N" badge sit, and how does it look and appear?

**Decision:** **top-right**, margin 3% of the video height; white text, 4% of the video height, on a dark,
slightly see-through rounded box; fades in and out over **200 ms** of video time, inside the stretch. If the stretch
is shorter than both fades, they shrink to fit. Nothing is configurable.

- **Why:** where players show speed; app content there is mostly a header; sizes follow the viewport.
- **Not chosen:** bottom-right (captions, chat and toast UIs); top-left (logos, navigation).

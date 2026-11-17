# 003: Cards are HTML pages, rendered frame by frame on a virtual clock

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how cards are drawn, and what a custom card can be?

**Decision:**
- Every card, built in or custom, is an HTML page. The composer opens it in its own headless Chromium at the reel's
  size, freezes its clock (Playwright's clock: timers, `Date`, `performance`, `requestAnimationFrame`), seeks every
  CSS and Web animation to the frame's time, and screenshots each frame.
- A custom card is any page in the script's folder, with its own CSS, JavaScript, images and fonts. The composer
  injects the card head first: the theme as `--fr-*` variables, the bundled fonts, the atoms (`fr-*` classes),
  `window.flowReel` (`props`, `theme`, `durationMs`, `logo`), and `data-prop="name"` filling.
- The network is off: the page loads only from the card origin, which serves the script's folder and the composer's
  fonts.

- **Why:** one renderer for the catalog and for the person's own cards, and the full flexibility of the web for custom ones, while staying deterministic: the same files give the same frames.
- **Not chosen:** cards drawn with FFmpeg filters (no layout, no web fonts, no custom cards); recording the page in real time (not deterministic); a template language of our own (one more thing to learn).

# 006: A brand block in flow-reel.json

**Superseded by GH-108 002** in part (2026-11-25): paths are relative to the scripts folder.

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how a reel gets its look?

**Decision:**
- `"brand": { "theme", "accent", "logo", "fonts": { "heading", "body" }, "enter", "exit" }` in `flow-reel.json`,
  every key optional. Paths are relative to the file, inside the script's folder.
- Four themes: `ink` (the default), `paper`, `ocean`, `ember`. `accent` replaces the theme's accent, and the text on
  it is chosen to read against it. A card's `theme` option overrides the brand's.
- Inter, Inter Tight and JetBrains Mono (OFL) are bundled in the image; brand fonts replace the first two.

- **Why:** set once, followed by every card, overlay and the skip card; per-card overrides where a reel needs one.
- **Not chosen:** brand options in the script (repeated in every script of a product).

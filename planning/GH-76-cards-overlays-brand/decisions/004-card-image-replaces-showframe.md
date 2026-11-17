# 004: card.image replaces showFrame

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** what happens to `showFrame`?

**Decision:**
- `card.image(path, { title?, frame: "browser" | "phone" | "none", fit? })` replaces `showFrame`, which is removed.
  A script calling `showFrame` gets an error naming `card.image`.
- It is a breaking change, released as 0.5.0 with a migration note.

- **Why:** one way to show a picture, which also frames it and titles it; two words for the same thing would make agents choose.
- **Not chosen:** keeping `showFrame` as an alias (two words for one concept, against CONTEXT.md).

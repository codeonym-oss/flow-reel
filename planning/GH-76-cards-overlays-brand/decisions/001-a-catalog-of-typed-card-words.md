# 001: A catalog of typed card words

**Date:** 2026-11-17 (story; the person validated the design canvas and delegated the open questions: "for your open
questions, pick whats more relevant, even if it has to add more work, rework something")

**Question:** how a script asks for a card?

**Decision:**
- One word per card on a `card` object: `card.intro()`, `card.chapter()`, `card.feature()`, `card.image()`,
  `card.compare()`, `card.outro()` and `card.custom(path, props)`. Each takes one object of props, typed in
  `src/index.ts`, so typing `card.` lists the catalog and the editor shows each card's props.
- A card is awaited, like `showFrame` was: it is an action of its step.

- **Why:** the API reads as what it shows, and the types document it; one object per card keeps calls readable and lets a prop be added without breaking scripts.
- **Not chosen:** a single `card(kind, props)` word (no completion per kind); positional arguments (unreadable past two).

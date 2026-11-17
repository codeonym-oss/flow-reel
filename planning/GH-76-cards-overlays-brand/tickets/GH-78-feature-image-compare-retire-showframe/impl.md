# GH-78 implementation plan: feature, image and compare cards, retiring showFrame

Story decisions 001, 002, 004. Planned on top of GH-77 (`feat/77-cards`), in the same session.

## Steps

1. **Three cards in the catalog** (`src/composer/cards/catalog.ts`): `feature` (kicker, title, one to five points with
   a check each, an optional screenshot in a browser window, `imageSide`), `image` (the image in a browser window, a
   phone beside the words, or alone; `fit`, `url`), `compare` (before and after, the after wiping in to a split down
   the middle, two labels). Image props are files in the script's folder, hashed into the event. → check:
   `cards.test.ts` (props, errors, hashes, page URLs), `test/e2e/cards.test.ts` (drawn, looked at).
2. **The words.** `card.image(path, props?)` takes the path first; the others one object. `CARD_WORDS` grows; typed
   in `src/index.ts` (`FeatureCard`, `ImageCard`, `CompareCard`). → check: `api.test.ts`.
3. **Retire showFrame** (decision 004): the `frame` event, `frameRequest`, image insertions in the timeline and the
   render, `Stage.showFrame` go; polish's masked spans are the cards'. `showFrame` stays in the types as
   `@deprecated` and fails the compose naming `card.image`, so the plugin, which teaches the released runtime, keeps
   type-checking until it moves to cards (GH-81). → check: unit tests; `render.test.ts` and `polish.test.ts` insert
   card clips; `record.test.ts` composes `card.image` and the `showFrame` hint (CI).
4. **Docs.** README: the new cards, "From 0.4 to 0.5"; CONTEXT.md: `showFrame` retired.

# GH-77 implementation plan: cards, the brand and transitions

Story decisions 001–003, 005, 006, 008. Planned against `main` at 300858d; the ticket pass and the build ran in one
session, with the spike below first.

## Spike (done first)

Playwright's clock in the composer image: `clock.install` + `pauseAt` freezes timers, `Date`, `performance` and
`requestAnimationFrame`; seeking every `document.getAnimations()` to "now minus when it appeared" makes CSS and Web
animations exact; `xfade` in FFmpeg 6.1 has fade, slideleft, wipeleft, zoomin, hblur, circleopen/close. ~65 ms a
frame at 640×360.

## Steps

1. **Event log v6.** `card` events (`card`, `props`, `files` with hashes, `ms?`, `enter`, `exit`, `theme`) and the
   skip's `style`. → check: `schema.test.ts`, `compare.test.ts`.
2. **The brand.** `src/composer/cards/brand.ts`: themes, transitions and their lengths, `validateBrand` (in
   `validateConfig`), `checkBrandFiles`, `themeFor` with the accent; `writeConfig` keeps the brand. → check:
   `cards.test.ts`, `settings.test.ts`.
3. **The catalog and the words.** `catalog.ts` (props per card, checked where written; intro, chapter, outro, skip
   bodies), `page.ts` (the head: theme variables, bundled fonts, atoms, `window.flowReel`, `data-prop`), `words.ts`
   (`cardRequest`, `cardOptions`, `cardWords`). → check: `cards.test.ts`.
4. **The timeline.** Cards and skip cards are one kind of insertion, `card: { id }`, placed in show order: a skip's
   1.5 s, a card's 3 s, each until its comment ends, or a card's exact `ms`. `timeline.cards` replaces `cardSpans`.
   → check: `timeline.test.ts`.
5. **The card painter port** (`ports.ts`) and its Chromium adapter (`src/adapters/chromium/painter.ts`): the core
   stays free of Playwright (`layout.test.ts`). The core's `media/cards.ts` extracts the app frames on either side,
   has the painter draw each frame, and assembles the clip with `xfade`; `fileFor` serves only the backdrop, the
   bundled fonts and the script's folder. → check: `test/e2e/cards.test.ts` (catalog, every transition, a custom
   card's clock and props with the network blocked, identical frames twice).
6. **Render.** `renderMaster` takes card clips; the drawn skip card in `polish-render.ts` goes. The camera eases out
   before a card (`polish.ts`). → check: `render.test.ts` (skip card), `polish.test.ts`.
7. **Compose and the API.** The stage's `card` words, the brand read beside the script, chapters numbered after the
   run; `ScriptContext.card` typed in `src/index.ts`. → check: `record.test.ts` "cards in a composed reel" (CI), and
   a local compose of a branded script, looked at frame by frame.
8. **Words and docs.** CONTEXT.md (card, custom card, transition, brand, theme, card painter), README (cards,
   custom cards, brand, the skip card). Fonts bundled in `docker/fonts` with their OFL notices.

## Risks

- Drawing is ~0.1–0.3 s a frame at 1440p: a 3 s card adds about 10–25 s to a compose.
- The app frames on either side of a card are the recording's, unpolished: the camera now eases out before a card, so
  they match what was on screen.

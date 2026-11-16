# GH-62 implementation plan: skip a wait, and release 0.4.0

Ticket decisions 001–004; story decisions 003, 005, 006, 007; GH-61 decisions 002, 004, 005, 008 (fonts, words
inside, log version 5, frame selection). Planned against `main` at 7988cee (GH-61 merged).

## Read first

- `src/composer/steps.ts`: `stepTimer` — `speedUp`, `outsideStretch`, the `stretch` flag and error wrapping.
- `src/composer/timeline.ts`: `planTimeline` (stretches, `dropped`, `mapWith`, the steps loop that adds holds),
  `retimeEvents`, `mapDuration`.
- `src/composer/media/render.ts`: `renderMaster` (spans, holds, images, stretches; the `"kept" in` sort).
- `src/composer/media/polish-render.ts`: `badge`, the font paths, `inImage` masking; `src/composer/polish.ts`
  (`imageSpans` in `PolishOptions`).
- `src/composer/compose.ts`: the stage (`speedUp`, `showFrame`), speed-ups passed to `planTimeline`, the log.
- `src/adapters/playwright/wrap.ts`: standalone `flash`/`zoomIn`/`zoomOut` (lines ~330) and the chained setters
  (~239); `stage` is a `Pick<Stage, …>`.
- `src/composer/schema/events.ts`, `src/compare.ts`, `src/composer/effects.ts`, `src/index.ts`, `src/composer/ports.ts`.
- Tests: `test/unit/{steps,timeline,schema,compare,api,effects}.test.ts`, `test/e2e/{render,record}.test.ts`.

## Steps

1. **Event and checks.** `SkipEvent { t, type: "skip", durationMs, label }` in the schema (version stays 5; `label`
   non-empty text), and `skipSettings(options)` in `effects.ts`: an options object with only `label` (non-empty
   string), default `"{duration} skipped"`. `formatDuration(ms)`: whole seconds, "38 s", "1 min 52 s", "2 min".
   → check: unit tests for the schema, the option errors (unknown key, empty or non-string label) and the formats
   (0.4 s → "0 s"; 38.4 s → "38 s"; 59.6 s → "1 min"; 112.4 s → "1 min 52 s"; 120 s → "2 min").
2. **The word in the step timer.** `skip(run, options, events)` beside `speedUp`: the same guards, `stretch = "skip"`,
   the event spliced in where it started with `durationMs` and the checked `label`. A new `outsideSkip(word)` check
   (throws `flash() can't be used inside skip(); put it before or after`) for the effect words.
   → check: `steps.test.ts`: event and order, nested `skip`/`speedUp` both ways throw, comment inside throws, an
   inner failure names the step once.
3. **Stage, wrapper and API.** `Stage.skip(run, options?)` and `Stage.checkEffect(word)` in `ports.ts`, forwarded in
   `compose.ts`; `wrap.ts` calls `stage.checkEffect` in the standalone `flash`/`zoomIn`/`zoomOut` and in the chained
   setters (add it to the `Pick`; the default stage's is a no-op). `skip(fn, options?)` in `ScriptContext` with its
   doc comment; passed through `integration.ts`.
   → check: `npm run typecheck`; `api.test.ts` types; a wrap unit test (if `wrap` has one) or the e2e step 8.
4. **Drop hidden events.** In `compose.ts`, before planning, remove every event (but the skip itself) whose `t` lies
   inside a skip's `[t, t + durationMs)`.
   → check: unit-test the filter as a small exported function in `timeline.ts` (`dropSkipped(events)`).
5. **Timeline.** `planTimeline` takes `skips: { t, durationMs, label }[]`: each is a stretch keeping 0 frames, plus a
   card insertion `{ frame: a, frames, card: { text } }` placed in the steps loop for the step that holds it. Its
   frames: at least 1.5 s, or until the step's comment ends plus 200 ms (measured from the card's start on the
   mapped clock), whichever is longer (decision 003); the step's hold then shrinks by it. The text is the label with
   `{duration}` filled in. Expose `cardSpans` (video ms). `retimeEvents` maps a skip's `t` to its card's start and
   keeps its `durationMs` (the real cut).
   → check: `timeline.test.ts`: a 60 s skip becomes a 1.5 s card; a comment 5 s long started 1 s before the skip
   makes the card 4.2 s and adds no hold; events after it move earlier by the cut minus the card; no skips gives
   today's result.
6. **Render the card.** In `renderMaster`, a card segment: the source frame before the skip
   (`trim=start_frame=a-1:end_frame=a`), held with `tpad` to `frames`, dimmed towards 40 % with a 200 ms fade in and
   out (e.g. `format=gbrp,geq` or `blend` on a timed expression; pick the one that stays exact on frame count), and
   the text centred, white, 6 % of the height, `⏭` in Noto Sans Symbols 2 and the words in Noto Sans Bold (two
   `drawtext`s centred as one line, measured with the em widths as for the badge; non-Latin glyphs fall back to
   tofu, a known limit of decision 002). Share the font path and fade helper with `polish-render.ts` rather than
   copying them.
   → check: `render.test.ts` in the image: frame count; mid-card pixel darker than the source frame; the text's
   white pixels in the centre; first card frame close to the source (fade in).
7. **Polish masks the card.** Pass `[...imageSpans, ...cardSpans]` as `imageSpans` to `polishFilters`, so no cursor,
   ripple or zoom is drawn over it.
   → check: the e2e still in step 8 shows no cursor on the card.
8. **compare and e2e.** `skip` joins `EFFECTS` in `compare.ts` with `durationMs` ignored, like `speed`. In
   `record.test.ts`: a 20 s wait in `skip(…, { label: "{duration} plus tard" })` with a comment before it composes
   into a reel about 18 s shorter; the card shows mid-way (dimmed centre, white text); the comment is spoken whole;
   `verify` passes; a second compose `compare`s equal; `flash()` inside fails the compose with the clear error.
   → check: unit `compare.test.ts`; the e2e file run in the image (the host's ffmpeg is never used).
9. **Docs.** README (a "Skip a wait" section beside "Speed up a wait", the `{duration}` label, what goes inside),
   `CONTEXT.md` (**Skip**, under the effect words). → check: read through.
10. **Ship.** PR `feat: skip a wait in a reel (#62)`; after it merges and `main`'s CI is green, merge release PR #64
    (0.4.0, check its `<details>` lists both words and no plugin section) → publish runs from `release-please.yml`.
    → check: `npm view flow-reel version` is 0.4.0; `docker manifest inspect ghcr.io/codeonym-oss/flow-reel:0.4.0`
    lists amd64 and arm64; GitHub release v0.4.0 exists.

## Tests

- Unit: `effects` (label, durations), `steps` (skip guards), `timeline` (cards, holds, dropped events), `schema`,
  `compare`, `api`.
- E2E in the image: `render` (card frames and pixels), `record` (the 20 s skip, label, guards, verify, compare).

## Risks

- **Holds and cards in one step:** a step with a skip and a long comment must not get both a long card and a hold;
  step 5's tests pin it.
- **The dim fade** must not change the frame count; the render frame-count check catches it.
- **Release:** merging #64 publishes npm and both images; `publish.yml` reruns e2e from the tag, so `main` must be
  green first (memory: publish tests run from the tag). The flaky effects compare test can hold it; rerun if so.
- **Fonts:** a `label` in a script Noto Sans doesn't cover (CJK, Arabic) draws boxes; README says so.

## Corrections during the build

- Step 6: the master holds the frame before the skip as a plain hold (the card is an insertion without an image), and
  polish draws the dimming and the words over it, after flashes and before badges, with the same fade helpers as the
  badge. This keeps the master's frame-exact path unchanged and puts all drawing in one place.
- Step 6: the words are centred with the icon as one line by reading advance widths from the bundled fonts
  (`media/fonts.ts`), since `drawtext` can't measure one text from another; the label goes to `drawtext` through a
  file with `expansion=none`, so no label needs escaping.
- Step 3: the effect words call `stage.checkEffect` when they are written (the standalone words and the chained
  setters), which the wrapper's unit test pins; the e2e checks `flash()` inside a skip.
- Step 5: a time exactly on a card's first frame lands after the card, as for holds and images; an event logged just
  before a skip (any earlier millisecond) plays before it.

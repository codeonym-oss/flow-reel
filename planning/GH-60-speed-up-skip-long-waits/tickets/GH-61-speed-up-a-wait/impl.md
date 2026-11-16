# GH-61 implementation plan: speed up a wait

Ticket decisions 001–008; story decisions 003, 005, 006, 007. Planned against `main` at 8b0b48e.

## Read first

- `src/composer/timeline.ts`: `planTimeline` (insertions, `mapWith`), `retimeEvents` (moves only `t` today).
- `src/composer/media/render.ts`: `renderMaster` (trim/tpad/concat segments), `renderTimeline` (frame-count checks).
- `src/composer/media/polish-render.ts`: `polishFilters`, the filter chain ending in `[polished]`; the ripple's
  rgba buffer is the model for the badge's box.
- `src/composer/compose.ts`: builds the `Stage`, `showFrame`, the log (`version: 4`), `planTimeline` call.
- `src/composer/steps.ts`: `stepTimer().action` wraps errors as `step N ("…") failed`.
- `src/composer/ports.ts` (`Stage`), `src/adapters/playwright/integration.ts` (`run`), `src/index.ts`
  (`ScriptContext`), `src/composer/effects.ts` (word checks), `src/composer/schema/events.ts`, `src/compare.ts`.
- `src/composer/media/sound-mix.ts`: how `docker/sfx/` is found at run time (the fonts follow the same path).
- `docker/Dockerfile`: copies `docker/tts` and `docker/sfx`; `package.json` `files` already ships `docker`.

## What the code showed

- Noto Sans has `×` but not `▶` (U+25B6) or `⏭` (U+23ED); both are in **Noto Sans Symbols 2** (OFL). Following
  decision 002's limits, two Noto files are bundled: Noto Sans Bold for text, Noto Sans Symbols 2 for the arrows.
- The local (Arch) ffmpeg has no `drawtext`; the image's ffmpeg (Ubuntu noble) is built with libfreetype. Rendering
  runs in the image, so only e2e tests exercise `drawtext`; step 1 checks it there first.
- A step's hold is inserted at its end frame. Comments can't be inside a stretch, so a hold never lands inside one,
  and showFrame images can't either: stretches and insertions never overlap.
- `locator.comment()` goes through `stage.comment`, so one check in compose's `Stage` covers both spellings.

## Steps

1. **Fonts.** Add `docker/fonts/NotoSans-Bold.ttf`, `docker/fonts/NotoSansSymbols2-Regular.ttf` and `OFL.txt`
   (from the Noto project's release), and `COPY docker/fonts ./docker/fonts` in the Dockerfile.
   → check: in the built image, `ffmpeg -filters | grep drawtext` is present, and a one-off
   `drawtext=fontfile=…:text='▶▶ ×4'` render shows the glyphs (look at a still).
2. **Event and log version 5.** In `schema/events.ts` add `{ t, type: "speed", factor, durationMs }`, validate it
   (factor per decision 001, `durationMs >= 0`), and move `EventLog.version` and its check to 5; `compose.ts`
   writes 5. Update the unit tests that build version-4 logs (`schema`, `compare`, `sfx`, `store`) and the e2e
   asserts in `record.test.ts`/`compare.test.ts`.
   → check: `npm test` passes; a version-4 log fails with "version must be 5".
3. **The word's checks.** In `effects.ts`, `speedSettings(factor)`: a finite number > 1 and ≤ 16, else
   `speedUp(): the factor must be a number above 1 and at most 16, got …`.
   → check: unit tests in `effects.test.ts` for 1, 0, 16.5, NaN, "2" throwing and 1.5, 16 passing.
4. **The word on the stage.** `Stage.speedUp(factor, run)` in `ports.ts`, implemented in `compose.ts`:
   check the factor; throw if already inside a stretch (`speedUp() can't be nested`, also `skip` later); then run
   `run` through `timer.action`, pushing `{ t: start, type: "speed", factor, durationMs: end - start }`
   after it returns. While inside, `comment` and `showFrame` throw `comment() can't be used inside speedUp(); put it
   before`. Inner actions call `timer.action` again: make `action` re-entrant without double-wrapping an error
   (an error that is already a step error passes through).
   → check: unit tests on `stepTimer` (nested action, error wrapped once) and on the stage's guards (a fake clock).
5. **Script API.** `speedUp(factor, fn): Promise<void>` in `ScriptContext` (`index.ts`) with its doc comment, passed
   through `integration.ts` `run`.
   → check: `npm run typecheck`; `test/unit/api.test.ts` covers the new member.
6. **Timeline.** `planTimeline` takes `stretches: { t, durationMs, factor }[]`. Each becomes source frames
   `[frameAt(t), frameAt(t + d))` rendered as `ceil(n / factor)` frames (decision 008). `mapTime` maps a time inside a
   stretch to `stretchStart + (t − start) / factor` and subtracts the frames removed by earlier stretches; `frames`
   counts them. Expose `stretches` on the `Timeline` with their video `startMs`/`endMs` and factor, for render and
   the badge. `retimeEvents` maps both ends of `durationMs` and zoom/flash `ms`, and scales `charDelayMs` by the
   same ratio (decision 003). The speed event's own `durationMs` is retimed the same way, so in the log it spans
   the stretch in video time.
   → check: unit tests in `timeline.test.ts`: a ×4 stretch of 60 frames becomes 15; ×1.5 over 2 frames becomes 2;
   a step after the stretch starts earlier by the removed frames; a comment that outlasts the stretch still holds at
   its end frame; an event crossing the stretch's edge gets the mapped duration; no stretches gives today's result.
7. **Render.** In `renderMaster`, a stretch is its own segment:
   `trim=start_frame=a:end_frame=b,setpts=PTS-STARTPTS,select='lt(ceil(n/f),(n+1)/f)',setpts=N/(fps*TB)`, between
   the spans around it; `renderTimeline` renders the master whenever there are insertions **or** stretches.
   The existing frame-count check proves the plan and ffmpeg agree.
   → check: `test/e2e/render.test.ts`, a capture with a ×1.5 and a ×4 stretch renders the planned frame count.
8. **Badge.** In `polishFilters`, after the flashes (so zoom never scales it), per stretch: a rounded dark box from
   an rgba buffer (like the ripple) overlaid top-right, and two `drawtext`s (arrows in Symbols 2, `×N` in Noto Sans
   Bold; `×1.5` for fractions), sized and placed per decision 006, with 200 ms alpha fades in video time that
   shrink to fit a short stretch. The chain still ends in `[polished]`.
   → check: `test/e2e/polish.test.ts`, stills taken mid-stretch show the badge's pixels top-right; stills outside
   it don't; a still at the fade's midpoint is partly transparent.
9. **compare.** Add `speed` to `EFFECTS` in `src/compare.ts`; the factor must match, starts within 150 ms.
   → check: `test/unit/compare.test.ts`, differing factors and a missing speed-up are reported.
10. **End to end.** A fixture script waits about 60 s for a slow fake endpoint inside `speedUp(4, …)` with a comment
    before it. → check: the reel's video is about 45 s shorter than without it; the comment is spoken whole;
    `verify` passes; two composes `compare` equal; `comment()`, `showFrame` and nested `speedUp` inside fail with
    the clear error.
11. **Docs.** README (the word, the factors, what can go inside, the badge), `CONTEXT.md` (**speed-up**, under the
    effect words), the version-5 note in the changelog body of the commit.
    → check: read through; `CONTEXT.md` terms used in the code and README.

## Tests

- Unit: `effects` (factor checks), `steps` (re-entrant action), `timeline` (mapping, lengths, durations),
  `schema` (speed event, version 5), `compare` (speed effect).
- E2E (in the image): `render` (frame counts), `polish` (badge stills), `record` (60 s wait, guards, verify, compare).

## Risks

- **Every reel needs composing again** (log version 5). Called out in the README and the release (GH-62).
- **The polish chain** is built as one filter graph; adding drawtext and an overlay could break the label chain
  for scripts with no flashes or clicks. Checked by the existing polish e2e tests plus one with only a stretch.
- **Timing-flaky compare** (follow-up `2026-11-16_0845_effects-compare-test-is-timing-flaky.md`): adding a speed
  effect gives that test one more thing to drift; if it fails, note it there, not here.
- **A 60 s e2e wait** lengthens CI on both arches; the fake endpoint's delay can be shorter (e.g. 20 s at ×4) if the
  run gets too long, as long as the 5:1 ratio is checked.

## Corrections during the build

- Step 6: `retimeEvents` shrinks a duration by the frames stretches drop inside it (`mapDuration`); holds and images
  inside an event's span don't lengthen it. This is decision 003's "events outside a stretch keep their durations
  exactly", and it keeps today's behaviour for every reel without a speed-up.
- Step 4: the guards and `speedUp` live in the step timer (`steps.ts`), which owns comments and actions, so they are
  unit-tested with its fake clock; compose's stage only forwards to it.
- Step 10: the slow reply is 20 s at ×4 (the risk noted below), not 60 s.
- Running the e2e tests on the host needs an ffmpeg with `drawtext`; the render, polish and sfx files were run inside
  the image instead (the host's `/usr/bin/ffmpeg` reports `n9.0.2`, which `render.ts`'s version check can't read).

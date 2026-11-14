# GH-32 implementation plan

Planned 2026-11-14 against `main` at 745eb95 (142 unit tests pass). Decisions: this ticket's 001-007, story 002, 003
(as superseded by 011), 009, 010, 011; GH-30 001; GH-1 012.

## Read first

- `src/index.ts`: `script()`, `ScriptOptions`, `ScriptContext`, the `Locator` augmentation.
- `src/composer/ports.ts`: `Stage`, `LoadedScript`.
- `src/adapters/playwright/wrap.ts`: `wrapLocator` (chained `sound` carried on the proxy, `act()`), `approach()`,
  the `pointer` it tracks; `integration.ts` `run()`.
- `src/composer/steps.ts`: `stepTimer().action` (settles, opens the step).
- `src/composer/sounds.ts`: `checkSound`, `soundLogger` (the pattern for effect loggers).
- `src/composer/schema/events.ts`: event types, `validateEvents`, version 3.
- `src/composer/timeline.ts`: `planTimeline` (holds at step ends, running `added` offset), `mapTime`, `retimeEvents`.
- `src/composer/media/render.ts`: `renderTimeline` (master built from holds, then polish and audio).
- `src/composer/polish.ts`: `planPolish` (camera and pointer curves, `fit`, `minShare`, deadlines).
- `src/composer/media/polish-render.ts`: curves as FFmpeg expressions, ripple and cursor overlays.
- `src/composer/compose.ts`, `src/compare.ts`, `src/cli.ts` (`compare`).
- Tests: `test/unit/{schema,timeline,polish,wrap,steps,compare,cli,api}.test.ts`,
  `test/e2e/{record,render,polish,compare}.test.ts`.

## Steps

1. **Event log version 4** (decision 005). In `schema/events.ts` add `flash {color, ms}`, `frame {image, sha256,
   durationMs, fit, background}`, `zoom {zoom: "in", at, bounds?, scale, ms}` and `zoom {zoom: "out", ms}`;
   `EventLog` becomes `{ version: 4; autoZoom: boolean; events }`. `validateEvents` checks hex `#rrggbb`, positive
   `ms`/`durationMs`, `fit` in `contain|cover`, `scale` in [1, 2], `image` relative without `..`, `sha256` digest.
   → check: new cases in `schema.test.ts`; version 3 is rejected.

2. **Effect options and loggers** in a new `src/composer/effects.ts` (decisions 002, 004): defaults
   (`flash` `#ffffff`/250, `zoomIn` 4/3/650, `zoomOut` 800, `fit` contain, `background` `#000000`), checks that throw
   with clear messages, and `resolveImage(scriptDir, path)` (relative, stays inside the folder, `.png|.jpg|.jpeg|.webp`,
   exists, returns its SHA-256). Loggers push events on the recording clock, as `soundLogger` does.
   → check: `test/unit/effects.test.ts`: defaults applied, each bad value's message, an image outside the folder, a
   missing image, a wrong extension.

3. **The timeline as capture plus insertions** (decision 003). `Hold` becomes `Insertion = { frame, frames } &
   ({ kind: "hold" } | { kind: "image", file, fit, background })`. `planTimeline` takes the frame events too: each
   image goes in at the first capture frame at or after its `t`; holds stay at step ends. All step times go through
   `mapTime` (drop the running `added`); an event at an insertion's own moment maps to after it. The hold that lets a
   comment finish compares mapped times, so it counts inserted frames.
   → check: existing `timeline.test.ts` passes unchanged; new cases: an image inside a step shifts the step's end and
   later steps and events by its frames; an image plus a hold in one step; a comment longer than step plus image gets
   only the missing frames held; two images at one moment keep their order.

4. **Render the master from the segments.** In `render.ts`, build the master from capture spans, cloned frames and
   image frames: each image is `-loop 1 -i <file>` scaled for `contain` (scale down, pad with `background`) or
   `cover` (scale up, crop), at the master's size, `fps` and pixel format, trimmed to its frame count. The image's
   absolute path is resolved from the script's folder by compose; the event log keeps the relative one.
   → check: e2e `render.test.ts`: an inserted solid-colour PNG fills exactly its frames in the master and the
   delivery; the frame after it equals the capture frame before it; frame counts match the timeline. Both `fit`s.

5. **Polish with explicit zoom, autoZoom and image spans** (story 011, decisions 005, 006). `planPolish` takes
   `autoZoom` and the image spans (delivery time):
   - `zoom in` takes the camera: target from `fit(at, bounds)` with the share floored at `1 / scale` (a large element
     zooms less), eased over `ms` from the current crop; a second `zoom in` pans from the current crop.
   - While held, automatic zoom events are skipped; `zoom out` eases to full over `ms` and releases the camera.
   - `autoZoom: false` skips every automatic zoom; cursor follow and ripples stay.
   - Over an image span the crop is full and no cursor or ripple is drawn; the camera resumes its curve after it.
   → check: `polish.test.ts`: no effect events gives exactly today's plan (snapshot of the curves for an existing
   event list); explicit zoom holds across a click that would have zoomed elsewhere; `autoZoom: false` keeps full
   frame through clicks; scale floor for a large box; pan between two zooms; nothing drawn over an image span.

6. **Flash and image spans in the render.** In `polish-render.ts`, a flash is a full-frame `color` source of its
   colour whose alpha fades from 1 to 0 over `ms`, overlaid last, from its first delivery frame (same frame alignment
   as ripples). Cursor and ripple overlays get `enable` expressions that exclude image spans.
   → check: e2e `polish.test.ts`: the flash's first frame is near its colour, it has faded after `ms`; a click
   inside an image span draws no ripple; no effect events renders byte-for-byte the filter graph of today.

7. **Script words.** `ScriptOptions.autoZoom?: boolean` (default true), `ScriptContext` gains `flash`, `showFrame`,
   `zoomIn`, `zoomOut`, and the `Locator` augmentation `flash`, `zoomIn`, `zoomOut` with typed options. `Stage`
   gains the loggers and `LoadedScript` gains `autoZoom`. In `wrap.ts` a chained effect rides on the locator proxy as a
   chained sound does: `zoomIn` logs when `approach()` has the box and before the pointer moves (or at the action's
   start, with `boundingBox()`, for uncovered actions), `flash` in `act()` with the sound, `zoomOut` after `act()`
   returns. Standalone `zoomIn` uses the wrapper's `pointer`, so the wrapper hands the standalone words to `run()`.
   `showFrame` runs through `stage.action` (settles, opens a queued comment's step), then logs its `frame` event.
   → check: `wrap.test.ts`: chained `zoomIn` logs before the move with the box, `flash` with the click, `zoomOut`
   after it; standalone `zoomIn` logs the pointer; `steps.test.ts`: a comment then `showFrame` opens one step holding
   the frame; `api.test.ts`: the types (an unknown option is a type error).

8. **Compose.** Create the loggers with the script's folder; when the script ends with a zoom held, log a `zoom out`
   with the default `ms`; write the log as version 4 with `autoZoom`; pass frame events and the script's folder to
   `planTimeline` and `renderTimeline`.
   → check: e2e step 10.

9. **Compare effects** (decision 007). `compareReels` (from `compareTranscripts`) also takes both event logs:
   same `autoZoom`, same sequence of `flash`/`frame`/`zoom` events with equal options and hashes, each `t` within
   150 ms. `cli.ts` reads `events.json` with the same guard as the transcript; the message becomes "Reels match
   (step starts and effects within 150 ms)."
   → check: `compare.test.ts` (each kind of difference named), `cli.test.ts` (message), e2e `compare.test.ts`.

10. **Composed fixture.** In `record.test.ts`, a script beside a generated PNG uses every word: a comment then
    `showFrame`, a chained `zoomIn().flash().click()`, a click while zoomed, `zoomOut()`, a standalone `flash()`, and a
    second script with `autoZoom: false`. Compose twice.
    → check: the event log holds the expected effects in order; the image's colour fills its frames in `video.mp4`; a
    flash frame is near white; the reels `verify` and `compare` match; the `autoZoom: false` reel's log says so and
    has no zoom events. Existing record tests, with no effect words, pass unchanged.

11. **Docs.** README: a "Direct the picture" section (the four words, options table, the zoom rule, `autoZoom`,
    images); `events.json` row says version 4; "Compare reels" message; a 0.1→0.2 row (event log version 3 → 4).
    `CONTEXT.md`: Effect's meaning lists the four words; add **Insertion** (an image or a hold put into the video's
    timeline).
    → check: the README examples type-check (`api.test.ts` compiles them, as for the comment words).

## Tests

- Unit: schema, effects options, timeline insertions, polish planning (zoom ownership, `autoZoom`, image spans,
  no-effect snapshot), wrapper timing, compare.
- e2e: render of image insertions and flash pixels; the composed fixture twice with `verify` and `compare`, on amd64
  and arm64 in CI.

## Risks

- **Timeline refactor shifts existing timings.** Moving step times to `mapTime` must give the same numbers when the
  only insertions are holds: the existing `timeline.test.ts` and the e2e sync tests (step starts, marker click within
  2 frames, ripple frame alignment) are the guard.
- **Polish for scripts without effects changes.** A snapshot of today's curves and filter graph for a fixed event
  list must not move.
- **Image decoding in the image.** FFmpeg 6 in the image must read PNG, JPEG and WebP; the e2e render covers all
  three on both architectures.
- **`zoompan` over image frames.** The crop is forced to full over image spans; the render test checks the image's
  corners are untouched.
- **Port change.** `Stage` and `LoadedScript` grow; the Playwright adapter is the only implementation.

## Corrections during the build

1. `Timeline.holds` is now `Timeline.insertions`; a hold keeps the shape `{ frame, frames }`, so the existing timeline
   tests changed only that name. The timeline also returns `imageSpans` (video time), and `retimeEvents` moves a
   `frame` event to where its image starts, not after it.
2. Polish over an image is masked where it is evaluated (`frame()` and the FFmpeg expressions), not written into the
   camera curves, so the curves for a script without effects are untouched. A one-off check against `main`'s planner
   over about 100 mixed events gave identical curves and frames. `frame()` reports `hidden` over an image.
3. The WebP image for the render test is a committed fixture (`test/e2e/fixtures/magenta.webp`): some FFmpeg builds,
   the host's among them, decode WebP but cannot encode it.
4. A comment followed by `showFrame` opening one step is covered by `stepTimer.action` (which `showFrame` runs
   through) and by the composed fixture, not by a new `steps.test.ts` case.
5. Noticed, not changed: a chained `sound` never plays on uncovered locator actions such as `press` (it plays only
   inside `act()`); chained effects do fire on them. A candidate follow-up.

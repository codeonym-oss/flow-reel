# Plan: The score (GH-139)

Decisions relied on: story GH-109 006, 007, 008; this ticket's 001 to 004.

## Read first

- `src/composer/steps.ts` (`stepTimer`, `opened`), `src/composer/phases/record.ts`, `src/composer/schema/cues.ts`,
  `src/composer/schema/events.ts`.
- `src/studio/server.ts` (the API), `src/studio/api.ts`, `src/host/results.ts`.
- `web/src/run.tsx`, `web/src/studio.css`; the mockup's score (`prototypes/studio-mockup.html`, `makeScore`).

## Steps

1. **Live times:** the `step` progress carries `t`, on the video clock as near as it is known.
   → check: unit test on `stepTimer`'s `opened`.
2. **Step pictures:** after its checks, record cuts one JPEG per step from the capture into `steps/`.
   → check: unit test for the frames chosen; in the image, a compose leaves `record/steps/*.jpg`.
3. **The score's data:** `GET /api/score?run=` from `cues.json`; `GET /api/step-picture?run=&step=`.
   → check: unit tests with a run folder holding a cue sheet and pictures; a missing record result answers 404.
4. **Web:** the score under the stage: ruler, Pictures, Steps, Comments, Sounds, Effects, Cards, the playhead while
   recording; Pictures / Lines only, Fold, zoom; buttons, arrows, tips, `[ ] 0 F`.
   → check: in Chrome, a real compose writes the score step by step, then fills in; a fake 60-step cue sheet stays
   readable fitted, zoomed and folded; every mark is reached by Tab and arrows; light and dark, 375 px.

## Risks

- The extra ffmpeg pass lengthens the record phase: measure it.
- Many marks in a long script: draw only what changes; 60 steps is a few hundred buttons at most.

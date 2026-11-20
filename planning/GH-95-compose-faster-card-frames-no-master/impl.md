# GH-95 implementation plan

Planned against `main` at 95fe58b, from the prototype on the local branch `proto/compose-speed` (beb5af8).

## Steps

1. **Card painter** (`src/adapters/chromium/painter.ts`): screenshots over CDP (`Page.captureScreenshot`, PNG,
   `optimizeForSpeed`, clip at the device scale; a transparent page gets a transparent default background, and a
   style hides the caret). A frame reuses the one before when no animation is running, none stopped on the frame
   before, and nothing marked the page changed (a DOM mutation or a frame callback). A page with a canvas, video,
   iframe or SVG animation is shot on every frame. → check: `cards.test.ts`, with a canvas card added.
2. **Card backdrops** (`src/composer/media/cards.ts`): both app frames in one ffmpeg call; the capture's frame count
   from `videoFrames`. → check: the transition tests in `cards.test.ts`.
3. **Frame counts** (`src/composer/media/render.ts`): `videoFrames` reads `nb_frames` from the header, no decode.
   → check: every e2e that counts frames.
4. **No master file:** the master's filters (spans, clones, stretches, skips, card clips) end in `[master]` and feed
   the delivery encode; `work.master` goes from the port, the store and the docs. → check: `render.test.ts`,
   `polish.test.ts` and `record.test.ts` read the delivery instead.

## Tests

- `cards.test.ts`: three composes painting the intro at once give the same frames; a canvas page changes frame to
  frame with no DOM change.
- The render tests check the delivery's frames and pixels where they checked the master's.

## Risks

- A custom card that changes pixels with no DOM change, no frame callback and no listed element would be frozen.
  Known cases (canvas, video, iframe, SVG animation) are shot every frame.
- The delivery encode now decodes the card clips itself: the same filters as before, in one process.

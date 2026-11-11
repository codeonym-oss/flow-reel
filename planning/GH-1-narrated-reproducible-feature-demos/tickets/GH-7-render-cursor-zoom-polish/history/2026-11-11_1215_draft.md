# Render a smooth cursor, click ripples, zoom on click and follow cursor from the event log

## Problem

Playwright's input moves no real cursor, so the recorded master shows things being clicked with no pointer, and a
1080p frame of a full 4K page is hard to follow (story decision 012).

## Change

- A post step that reads `events.json` (story decision 013) and the 4K master, and renders `demo.mp4` at 1080p with:
  a cursor sprite following the runner's eased paths, a ripple on each click, a zoom that eases in around a click or
  typing target and follows the cursor while zoomed, and eases back out.
- Built on ffmpeg filter graphs (no Remotion: story decision 012).
- Voice and timing stay as GH-5 left them: polish never changes `transcript.json` timings.

## Out of scope

Sounds (the SFX ticket); intro and outro cards; burned-in captions.

## Done when

- The sample demo shows the cursor moving to and clicking every target, with a ripple at each click's `t`.
- Zoom-ins are sharp (rendered from the 4K master) and never cut off the clicked element.
- Two renders from the same inputs are identical (the render is deterministic given its inputs).

## For the ticket pass

- Zoom rules: which events zoom, levels, easing, minimum hold, merging nearby targets.
- Cursor and ripple assets, and per-OS cursor styles.
- Filter-graph approach (`zoompan` vs per-frame `crop`+`scale` expressions) and render speed.

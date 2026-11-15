# Direction: the camera and the picture

The composer already directs a lot by itself (**polish**). Direct only where it does the wrong thing for the story.
All exact options are in `language.md`.

## What polish does alone

- A drawn cursor follows every pointer move; every click shows a ring for 400 ms.
- A click or typing zooms in over 650 ms toward the target (at most 4/3), holds until 2 s after the latest click or
  typing, then eases out over 800 ms. Nearby clicks keep the zoom and pan with it.
- Hovering and scrolling alone don't zoom. Large targets zoom less so they stay whole.

That suits forms and buttons. It's wrong when:

| The story needs | Polish does | Direct it with |
|---|---|---|
| The camera on a result (a chart, a new row) while the comment explains it | Nothing: hover doesn't zoom, and after a click it zooms on the button, not the result | `locator.zoomIn().hover()` on the result, then `.zoomOut()` chained on the next scene's first action |
| A steady wide shot of a whole page (a dashboard tour) | Zooms in and out at every click: restless | `autoZoom: false` in the script's options |
| Emphasis on one instant (the save happened, the error appeared) | A ring at the click only | `flash()` after the result's wait, usually with a sound |
| A title, a diagram, a before-screenshot | Nothing | `await showFrame("title.png", 2500)` |
| A closer look at small UI | 4/3 at most | `zoomIn({ scale: 1.6 })`, accepting some softness above 4/3 |

## Holding the camera

`zoomIn` holds until `zoomOut`, across steps and clicks, so you can frame a region and keep acting inside it.

- **Zoom in as the scene starts**, chained on the element the viewer should look at: `.zoomIn().hover()` moves the
  pointer there and frames it.
- **Zoom out with the next scene's first action:** chain `.zoomOut()` on it (`button.comment("…").zoomOut().click()`).
  A chained `zoomOut` happens after its action, so the zoom holds through the previous comment.
- **Don't write a standalone `zoomOut()` (or `flash()`, `sound()`) between two scenes to mark the second one's
  start.** A standalone word happens when it is called, and the hold that lets a comment finish comes after its
  step's last action. A word written after a step's last action, even after the next `comment`, happens before
  that hold: the camera would leave the chart while its comment is still being spoken.
- A second `zoomIn` pans to the new target without zooming out: good for moving between two parts of a chart.
- **End on a click or on the wide shot, not on an explicit zoom.** A zoom still held when the script ends eases out
  as the last actions end, before the last comment has finished. A click at the end gets polish's zoom, which holds
  for 2 s of the final video, comment included.
- `zoomOut({ ms: 1200 })` chained on the last action gives a slower, calmer exit.

## Flash

A flash fades the screen from a colour in `ms` milliseconds. Use at most one or two in a reel, for the moments the
takeaway depends on. White, short (the default), reads as a "camera flash" of success. A brief dim red
(`{ color: "#ff3b30", ms: 200 }`) reads as an alert. Never flash during typing or on every click.

## Shown frames (cards and diagrams)

`showFrame(image, ms)` inserts an image into the video; the app resumes exactly where it was. Use it for:

- a **title card** at the start (product name, the feature, one line): 2–3 s;
- a **diagram** that explains what happens behind the click: 3–5 s, with a comment over it;
- a **before** screenshot, to contrast with the live after.

Make the image at 1920×1080 (or the viewport's proportions) and put it in the script's folder. `fit: "contain"`
letterboxes it on `background`; `"cover"` fills and crops. flow-reel doesn't draw text or cards itself.

## Pacing

- A scene lasts as long as its actions plus its comment; there is no duration option. To slow a scene, give it a
  comment worth saying; to quicken it, shorten the comment or merge two scenes.
- Long typing is slow (60 ms a character): type short values.
- Two or three zooms in a 30-second reel is plenty. Constant camera motion tires the viewer: prefer `autoZoom:
  false` plus one or two deliberate `zoomIn`s for overviews.

## Checking the picture

After composing, `scripts/stills.mjs` writes a frame at each step's start and end. Check that every zoom frames its
target whole, that the payoff is on screen in the last still, and that nothing important is cut at the edges.

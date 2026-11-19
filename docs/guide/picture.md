# Direct the picture

## Polish: automatic

Without any word in the script, the composer polishes the picture:

- **A drawn cursor**, a white arrow with a dark outline, glides along the logged pointer motion.
- **Click ripples:** a blue ring expands and fades for 400 ms at each click.
- **Zoom on activity:** a click or typing eases the camera in over 650 ms, to at most 4/3 (about 1.33×). The camera
  stays zoomed until 2 s after the latest click or typing, then eases out over 800 ms. More activity extends the zoom.
  Hover and scrolling alone don't trigger it.
- **Follow:** the camera follows the pointer and stays within the recorded page. A large target zooms less, so it
  stays whole in the frame.

The cursor and ripples keep their screen size while the page zooms. The recording is made at 2560×1440 (the viewport
× 4/3), so zoom up to 4/3 stays sharp in the 1080p video.

`autoZoom: false` in the script's options turns automatic zoom off for the whole script. The cursor, ripples and
explicit zoom stay.

## Effects

Effects direct the picture where polish isn't enough. Like `comment` and `sound`, each stands alone or chains on the
element it is about.

```ts
export default script({ url: "http://localhost:4173" }, async ({ page, flash, zoomIn, zoomOut }) => {
  await page.getByRole("button", { name: "Save" })
    .zoomIn({ scale: 1.5 })
    .flash()
    .click();
  await page.getByLabel("Name").fill("Ada"); // still zoomed in
  zoomOut();
});
```

| Word | Options (defaults) | When it happens |
|---|---|---|
| `flash(options?)` | `color: "#ffffff"`, `ms: 250` (fade-out) | Standalone: now. Chained: when the action happens. |
| `zoomIn(options?)` | `scale: 4/3` (1 to 2), `ms: 650` | Standalone: on the pointer. Chained: as the pointer heads for the element. |
| `zoomOut(options?)` | `ms: 800` | Standalone: now. Chained: after the action. |

### Zoom

- `zoomIn` **holds the camera until `zoomOut`**, across steps and clicks. Automatic zoom waits meanwhile.
- A second `zoomIn` pans to its new target.
- A zoom still held when the script ends eases out.
- The camera still keeps the cursor in frame. A large element zooms less than `scale`, so it stays whole.
- Above 4/3 the picture is enlarged past the recording's resolution and softens. Use it for small text only.

### When a standalone word happens

When it is called. The hold that lets a step's comment finish comes **after** that step's last action, so a
standalone word written after a step's last action (even after the next `comment`) happens before that hold. To act
at the next scene's start, chain the word on that scene's first action:

```ts
await chart.comment("The chart follows the filter.").zoomIn().hover();

await page.getByRole("button", { name: "Save view" })
  .comment("Save it as a view.")
  .zoomOut()          // after this click, so the chart stays framed through its comment
  .click();
```

## Long waits

A wait shows in real time unless the script shortens it. Wrap the wait, and only the wait, in one of two words.
**Pick by what the viewer should see:** `speedUp` when the progress means something (an answer streaming in, a list
filling up), `skip` when only the result matters (a build, an upload, a long job).

### Speed up a wait

```ts
comment("Ask the agent, and watch it work through the answer.");
await page.getByRole("button", { name: "Send" }).click();
await speedUp(4, () => page.getByText("Done").waitFor({ timeout: 120_000 }));
```

`await speedUp(factor, fn)` runs `fn` as one action of its step and plays that stretch `factor` times faster, with a
"▶▶ ×4" badge in the top-right corner that fades in and out.

- **The factor** is above 1 and at most 16, fractions included (`1.5`). Frames are dropped, not blended, so it reads
  as fast-forward.
- **Inside `fn`:** actions, sounds, `flash` and zoom, at the faster pace. `comment`, a card, an overlay, and another
  `speedUp` or `skip` throw there, since they would add time. Put them before or after.
- **A comment** spoken over the stretch keeps its normal speed. If it outlasts the shortened stretch, the last frame
  holds until it ends.

### Skip a wait

```ts
comment("The build takes a while; here is the result.");
await page.getByRole("button", { name: "Build" }).click();
await skip(() => page.getByText("Build passed").waitFor({ timeout: 300_000 }), { style: "bar" });
```

`await skip(fn, options?)` runs `fn` as one action of its step and cuts that stretch from the video. In its place, a
card over the blurred frame from before the wait says how long was cut.

| Option | Values | Default |
|---|---|---|
| `label` | the card's words. `{duration}` shows the length cut ("38 s", "1 min 52 s"). A label without it shows as written. | `"{duration} skipped"` |
| `style` | `"clock"`: a panel in the middle with a clock ring. `"bar"`: a bar along the bottom. | `"clock"` |

- **It lasts** 1.5 s, or longer while a comment spoken over it hasn't finished. The comment is never cut. It
  follows the [brand](brand.md), and no cursor or zoom is drawn over it.
- **Inside `fn`:** actions and sounds only, and nothing of them is seen or heard. `comment`, a card, an overlay,
  `flash`, zoom, `speedUp` and another `skip` throw there.

### Both

- Pass a function (`() => …`), not a promise.
- **Give the wait a `timeout`** that covers the real wait, since Playwright's default is 30 s.
- The event log records each as a `speed` or `skip` event, and `compare` checks the factor, the label and the style.
  How long the wait itself took may differ between composes.

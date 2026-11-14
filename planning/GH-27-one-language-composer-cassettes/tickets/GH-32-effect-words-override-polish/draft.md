# Direct the picture with effect words that override automatic polish

## Problem

The picture is polished automatically (cursor, click ripple, zoom on click, follow). A script cannot flash the
screen, show a still image, or decide where the camera zooms.

## Change

Add the effect family to the script language (decisions 001, 002): `flash`, `showFrame`, `zoomIn` and `zoomOut`,
standalone or chained on a locator, each taking options.

```ts
export default script({ url, autoZoom: false }, async ({ page, comment, flash, showFrame, zoomIn, zoomOut }) => {
  comment("Here's how the pieces fit.");
  await showFrame("diagram.png", 3000, { fit: "contain" });
  await page.getByRole("button", { name: "Save" }).zoomIn({ scale: 1.5 }).flash().click();
  zoomOut();
});
```

- **`showFrame`** inserts an image into the video's timeline; the capture resumes on the frame it left (decision 003).
  Images are PNG, JPEG or WebP in the script's folder; the event log records each one's hash (decision 004).
- **Zoom:** automatic polish stays the default. An explicit zoom holds the camera from `zoomIn` until `zoomOut`, across
  steps; `autoZoom: false` turns automatic zoom off (story decision 011). A chained `zoomIn` starts as the pointer
  heads for its element; `flash` fires at the action, `zoomOut` after it (decision 006).
- **Output:** event log version 4 records each effect's intent and `autoZoom` (decision 005); `flow-reel compare`
  also checks effects (decision 007).

Effects are rendered in post from the event log, like today's polish.

## Out of scope

Intro and outro cards, burned-in captions, background music, transitions between scripts.

## Done when

- Each effect is visible in a composed fixture and checked by a test on the rendered video or the event log.
- A script without effect words renders as before this ticket.
- The rule for explicit zoom against automatic zoom is documented and tested, including the off switch.
- Composing the same script twice gives the same effects, which `flow-reel compare` checks.

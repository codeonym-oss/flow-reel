# 001: Four effect words, standalone or chained, each taking options from the start

**Date:** 2026-11-14 (ticket pass, Q1; agreed: "2")

**Question:** how does a script write each effect?

**Decision:** **`flash`, `showFrame`, `zoomIn` and `zoomOut`, lowercase, in the script context and chained on
locators like `comment` and `sound`, each taking an options object from the first release.** `showFrame(image, ms)`
is standalone only and awaited (it takes time, as an action of its step); the others return at once. A chained word
fires when its element's action happens; a standalone one fires where it is written. A script option turns
automatic zoom off; the cursor and click ripple stay.

```ts
export default script({ url, autoZoom: false }, async ({ page, comment, flash, showFrame, zoomIn, zoomOut }) => {
  await showFrame("diagram.png", 3000);
  await page.getByRole("button", { name: "Save" }).zoomIn({ /* options */ }).flash({ /* options */ }).click();
  zoomOut();
});
```

- **Why:** the person's choice: a script can tune each effect without waiting for a later release.
- **Not chosen:** no options until asked for (less to test, but every tweak waits for a release); one `effect` word
  with constants like `sound` (showFrame and zoom need arguments, which constants carry badly).
- **Open:** the options of each word and their defaults; Q2.

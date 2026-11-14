# 001: Lowercase `comment` and `sound`, chained or standalone; a comment opens a step

**Date:** 2026-11-14 (ticket pass, Q1; agreed: "ok")

**Question:** how does a 0.2 script read?

**Decision:** **`export default script(options, async ({ page, comment, sound }) => …)`.** `comment(text)` and
`sound(name)` exist standalone and chained on any element (`locator.comment(text).sound(name).click()`), with one
spelling each. **A comment opens a step:** everything the script does after it, until the next comment, belongs to
that step and happens while the line is spoken. A chained comment opens its step just before that element's
action. A chained sound plays when the action happens; a standalone sound plays where it is written.

```ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:3000" }, async ({ page, comment, sound }) => {
  comment("This is the settings page.");
  await page.getByLabel("Name").fill("Ada");
  await page.getByRole("button", { name: "Save" })
    .comment("Save, and the change is applied at once.")
    .sound("success")
    .click();
});
```

- **Why:** reads top to bottom as the video plays; keeps the transcript's step model, so timing, voicing and
  captions are unchanged; sound names still autocomplete as a string union.
- **Not chosen:** capitalised standalone words with a `.sound.success()` namespace (two styles in one file); an
  explicit `step(comment, action)` block (the 0.1 shape, with nowhere natural for a chained comment).

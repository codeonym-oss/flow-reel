# Scenes: building each moment

A **scene** is a few steps with one purpose: filter the list, open the dialog, show the result. It is how you plan
and review a reel; in the script it is a comment followed by the actions it covers.

## Before the action: set the stage

- **Viewport.** `[1920, 1080]` suits most web apps. A narrow app (a mobile layout) can use a smaller one, e.g.
  `[1280, 720]`; the video is still 1920×1080 and the page is scaled. Pick one per reel.
- **Starting state.** The composer opens `url` in a fresh browser. Whatever the reel needs on screen must be
  reachable from there without a login you can't script: seed data, a public route, or a demo account whose sign-in
  the script itself performs (only with the person's consent and a test account; never a real password).
- **Realistic, short data.** Names people recognise ("Billing revamp", "Ada"), not "test1". Type short values:
  typing runs at 60 ms a character, so a 40-character address takes 2.4 s on screen.
- **Nothing in the way.** Close cookie banners and tours with real actions at the start, in a step with no comment,
  or prefer a URL or seed state where they don't appear.
- **Visible before it is used.** The camera frames a target from its bounds before the action. An element that
  appears only after a scroll or an animation should be visible (scroll it into view, wait for it) before the step
  that acts on it.

## During: one purpose, one result

- One comment per scene, at its start. It may cover several actions (open, type, save).
- Each action is something the viewer should see. Don't click to "trigger" a zoom; use `zoomIn` (`direction.md`).
- Prefer pointer actions (`click`, `fill`, `check`, `selectOption`) to `press` and `evaluate`, which run without
  visible motion.

## After: wait for the result, then let it land

- **Wait for what the viewer should see**, never a fixed time: `await page.getByRole("status").filter({ hasText:
  "saved" }).waitFor()`. Network quiet after a step is not proof that the app finished.
- **Then mark it:** a success sound or a flash goes after the wait, never before (`sound-design.md`).
- **Let it land.** The video already holds the last frame until the comment is spoken. When the result needs
  reading time beyond the comment (a table, a chart), give the scene a comment that talks about it, or frame it
  with `zoomIn` so the viewer knows where to look. A `page.waitForTimeout(…)` pause is a last resort, for reading
  only, and never a substitute for waiting on a real state.
- **Shorten a long wait, don't sit through it.** When the result takes more than a few seconds (an agent's reply,
  a build), wrap the wait in `speedUp` or `skip` (`direction.md`, "Pacing"). Note the wait's length while exploring.

## Common scenes

| Scene | Starting state | Action | Result to wait for |
|---|---|---|---|
| Filter or toggle | list visible | click the control | rows or chart changed |
| Create | list visible | open, fill, save | the new item in the list, the success message |
| Edit | item visible | open, change, save | the changed value shown |
| Error and recovery | form visible | submit a bad value | the error message; then fix and resubmit |
| Navigate | page A | click the link | page B's heading |
| Long job | job ready to start | start it | the finished state, behind `speedUp` or `skip` |

`shots.md` has worked scripts for these, with comments, sounds and effects.

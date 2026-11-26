# Shots: recipes that combine comments, sounds and effects

Each recipe is a whole script (they are typechecked against flow-reel), followed by why it works. Replace the URL,
the locators and the text with what you observed in the app (`exploring.md`).

## The saved form

The workhorse: open, fill, save, wait, mark the result.

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/projects" }, async ({ page, comment, sound, flash }) => {
  comment("Start a new project for the launch.");
  await page.getByRole("button", { name: "New project" }).sound(Sounds.navigation.OPEN).click();
  await page.getByLabel("Name").fill("Spring launch");
  await page.getByLabel("Owner").selectOption("Ada");
  await page.getByRole("button", { name: "Create" }).click();

  await page.getByRole("row", { name: /Spring launch/ }).waitFor();
  sound(Sounds.feedback.SUCCESS);
  flash();
  await page.getByRole("row", { name: /Spring launch/ })
    .comment("It's on the list, assigned to Ada.")
    .hover();
});
```

- One comment covers the whole form: the viewer follows the pointer, the voice gives the purpose.
- The sound and the flash wait for the row, so they mark the real result. The reel ends on the wide shot, with the
  pointer on the new row: an explicit zoom at the very end would ease out before the last comment finished.

## The reveal

A result appears somewhere other than where the click was. Point the camera at it.

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment }) => {
  comment("Filter to the active projects.");
  await page.getByRole("button", { name: "Active" }).sound(Sounds.controls.TOGGLE).click();

  await page.getByRole("region", { name: "Tasks closed per week" })
    .comment("The chart follows the filter: active work is picking up.")
    .zoomIn()
    .hover();

  await page.getByRole("button", { name: "All" })
    .comment("Back to the whole board.")
    .sound(Sounds.controls.TOGGLE)
    .zoomOut()
    .click();
});
```

- Polish would zoom on the filter button, not on the chart; `zoomIn` on the chart holds while its comment plays.
- `.zoomOut()` chained on the next scene's click widens the shot after that click. A standalone `zoomOut()` written
  before it would happen before the chart's comment had finished (`direction.md`).

## Before and after

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/settings" }, async ({ page, comment, card }) => {
  comment("Last release, the report took a full page of settings.");
  await card.image("before.png", { title: "Before", frame: "browser", url: "orbit.dev/settings" });

  await page.getByRole("heading", { name: "Report" })
    .comment("Now it's one switch.")
    .zoomIn()
    .hover();
  await page.getByRole("switch", { name: "Weekly report" }).sound(Sounds.controls.TOGGLE).click();
  await page.getByText("Weekly report on").waitFor();
});
```

- `before.png` is a screenshot of the old screen, saved in the scripts folder. The comment plays over its card.
- With screenshots of both versions, `card.compare({ before, after })` wipes from one to the other instead.
- The live "after" follows, framed, with a toggle sound on the switch.

## Error and recovery

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/invite" }, async ({ page, comment, sound }) => {
  comment("Inviting someone with a typo in their address…");
  await page.getByLabel("Email").fill("ada@example");
  await page.getByRole("button", { name: "Send invite" }).click();

  await page.getByText("Enter a full email address").waitFor();
  sound(Sounds.feedback.ERROR);
  await page.getByText("Enter a full email address")
    .comment("…is caught before anything is sent.")
    .zoomIn()
    .hover();

  await page.getByLabel("Email")
    .comment("Fix it, and the invite goes out.")
    .zoomOut()
    .fill("ada@example.com");
  await page.getByRole("button", { name: "Send invite" }).click();
  await page.getByText("Invite sent").waitFor();
  sound(Sounds.feedback.SUCCESS);
});
```

- The error is part of the story, so it gets the error sound and the camera; the recovery gets the success sound.
- Comments split across the error ("…is caught before…") keep one sentence across two scenes.

## The settings toggle

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/settings" }, async ({ page }) => {
  await page.getByLabel("Dark mode")
    .comment("One switch turns on dark mode, everywhere.")
    .sound(Sounds.controls.TOGGLE)
    .check();
  await page.locator("html[data-theme=dark]").waitFor();
});
```

- The smallest useful reel: one scene, one action, one sound. Polish zooms on the click by itself.

## The title card and the calm overview

```ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:4173/", autoZoom: false }, async ({ page, comment, card }) => {
  comment("Orbit: every project, one board.");
  await card.intro({ kicker: "Orbit", title: "Every project, one board" });

  comment("Projects on the left, this week's progress on the right.");
  await page.getByRole("region", { name: "Project list" }).hover();
  await page.getByRole("region", { name: "Tasks closed per week" }).hover();
});
```

- `autoZoom: false` keeps a steady wide shot for a tour, where zooming at every click would be restless.
- The intro is drawn by flow-reel in the brand's look; the comment is spoken over it.

## Chapters, a callout and an outro

```ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment, card }) => {
  comment("Saved views keep your filters one click away.");
  await card.intro({ kicker: "Orbit 2.4", title: "Saved views" });

  comment("First, save the filters you use every day.");
  await card.chapter({ title: "Save a view" });
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByLabel("View name").fill("Active work");
  await page.getByRole("button", { name: "Save" }).click();

  comment("Then share it with your team.");
  await card.chapter({ title: "Share it" });
  await page.getByRole("button", { name: "Share" }).click();
  comment("Everyone on the team sees the same view.");
  await page.getByRole("list", { name: "Members" }).callout("Shared with 4 people", { detail: "They get it in their sidebar" });

  comment("Try saved views today.");
  await card.outro({ title: "Try saved views", url: "orbit.dev/views" });
});
```

- Each chapter's comment is spoken over its card, which lasts as long as it.
- The callout's comment comes first; the callout stays through it, until the next action.

## Moving between two parts of a screen

```ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page }) => {
  await page.getByRole("cell", { name: "Billing revamp" })
    .comment("Billing is the furthest along…")
    .zoomIn({ scale: 1.5 })
    .hover();
  await page.getByRole("cell", { name: "Team invites" })
    .comment("…and team invites have just started.")
    .zoomIn({ scale: 1.5 })
    .hover();
  await page.getByRole("button", { name: "All" })
    .comment("Every project, on one board.")
    .zoomOut({ ms: 1200 })
    .click();
});
```

- A second `zoomIn` pans from one target to the next without widening; a slow `zoomOut`, chained on the next
  scene's action, widens after both comments have been spoken.
- Above 4/3 the picture softens a little: worth it for small table text, not for whole panels.

## The agent's reply (speed up)

An answer streams in over half a minute. Watching it grow tells the story; watching it in real time doesn't.

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/assistant" }, async ({ page, comment, sound, speedUp }) => {
  await page.getByLabel("Message")
    .comment("Ask the assistant to summarise last week's incidents.")
    .fill("Summarise last week's incidents");
  await page.getByRole("button", { name: "Send" }).click();

  comment("It reads every report, and writes the summary as it goes.");
  await speedUp(6, () => page.getByRole("status").filter({ hasText: "Done" }).waitFor({ timeout: 120_000 }));
  sound(Sounds.feedback.NOTIFICATION);

  await page.getByRole("article").last()
    .comment("Three incidents, each with its cause and its fix.")
    .zoomIn()
    .hover();
});
```

- The comment comes before `speedUp`, so it plays over the faster stretch at normal speed. Pick the factor from the
  wait you measured while exploring: 30 s at ×6 is 5 s of video, about one comment.
- Only the wait is inside. The sound and the zoom on the answer come after it, at normal speed.
- The `timeout` covers the slowest reply you saw, with room to spare; Playwright's default 30 s would fail the
  compose on a slow day.

## The long build (skip)

A job runs for minutes and shows nothing worth watching: a build, a deploy, an export. Only the result matters.

```ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173/pipelines" }, async ({ page, comment, sound, flash, skip }) => {
  await page.getByRole("button", { name: "Run pipeline" })
    .comment("Start a build of the main branch.")
    .click();

  comment("The build takes a few minutes; here is the result.");
  await skip(() => page.getByText("Build passed").waitFor({ timeout: 600_000 }));

  sound(Sounds.feedback.SUCCESS);
  flash();
  await page.getByRole("link", { name: "Download artifacts" })
    .comment("It passed, and the artifacts are ready to download.")
    .hover();
});
```

- The card says how long was cut ("3 min 12 s skipped"), so the viewer knows time passed; `style: "bar"` puts it in
  a bar along the bottom instead of a panel in the middle. The comment before
  `skip` plays over the card, which stays until it ends.
- `{ label: "A few minutes later" }` replaces the words, for a reel where the exact time doesn't matter or varies
  between composes; `{ label: "{duration} plus tard" }` for a French reel.
- Nothing inside a skip is seen or heard: mark the result after it, never inside.

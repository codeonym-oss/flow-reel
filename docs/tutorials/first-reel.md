# Your first reel

This tutorial builds a complete reel of a feature: from the story, through the script, to a reviewed video. It films
**Orbit**, the small example app from the [Quickstart](../getting-started/quickstart.md), and ends with the
[showcase reel](../demos.md) on the front page.

You will learn to:

1. plan a reel as a few scenes;
2. write comments that fit their steps;
3. mark moments with sounds;
4. direct the camera where polish isn't enough;
5. add cards and overlays;
6. compose, check and change the reel.

Start Orbit (`node serve.mjs`, see the Quickstart) and work in the same folder.

## 1. Plan the story

A reel is short: one audience, one takeaway, three to five scenes. Write it down before writing any code:

| | |
|---|---|
| **Audience** | Orbit users who filter the same projects every day. |
| **Takeaway** | A filter can be saved as a view, and found again in one click. |
| **Scenes** | 1. The projects, filtered to active ones. 2. The chart follows the filter. 3. Save the view. 4. It's in the sidebar. |

Each scene becomes one comment, and the actions that show it.

## 2. One comment per scene

```ts
// tour.ts
import { script } from "flow-reel";

export default script({ url: "http://localhost:4173/" }, async ({ page, comment }) => {
  comment("Here are this quarter's projects. Let's keep the active ones.");
  await page.getByRole("button", { name: "Active" }).click();

  comment("The chart follows the filter: active work is picking up every week.");
  await page.getByRole("region", { name: "Tasks closed per week" }).hover();

  comment("To come back to it later, save it as a view.");
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByLabel("View name").fill("Active work");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "saved" }).waitFor();

  comment("It's in the sidebar now, one click away.");
  await page.getByRole("navigation", { name: "Saved views" }).getByRole("link", { name: "Active work" }).hover();
});
```

How steps work:

- `comment(text)` opens a **step**. The step starts with the next action and takes in every action until the next
  comment.
- `comment` returns at once, so don't `await` it.
- If a comment takes longer to say than its actions take to do, the video holds the step's last frame until the line
  is finished, plus 200 ms. Speech is never cut off.
- After each step's last action, the composer waits for the network to go quiet (at most 10 s). That doesn't prove
  your app is done, so **wait for the visible result yourself**, as with `waitFor()` above.

Compose it once to see where you are (a cloud voice makes this loop fast, see [Voices](../guide/voices.md)):

```sh
npx flow-reel compose tour.ts --voice openai     # or without --voice for the built-in local voice
```

Polish is already there without any extra code: the cursor, the click ripples, and the camera zooming in on each
click and on typing.

## 3. Chain words on the element they're about

A comment can be chained on the locator whose action opens the step. That reads better, and keeps the line next to
what it describes:

```ts
await page.getByRole("button", { name: "Save view" })
  .comment("To come back to it later, save it as a view.")
  .click();
```

Sounds, effects and overlays chain in the same way.

## 4. Mark the moments that matter

Clicks and typing make sounds by themselves. Add a named sound only where something meaningful happens, and always
**after** the state it describes:

```ts
import { script, Sounds } from "flow-reel";

// ...
await page.getByRole("button", { name: "Active" }).sound(Sounds.controls.TOGGLE).click();
// ...
await page.getByRole("status").filter({ hasText: "saved" }).waitFor();
sound(Sounds.feedback.SUCCESS);        // after the toast is visible, not before
```

There are eight sounds in three groups. See [Sounds](../guide/sounds.md).

## 5. Direct the camera

Automatic zoom follows clicks and typing, but a hover doesn't trigger it. To hold the camera on the chart while the
comment explains it, zoom in explicitly, and zoom out on the next scene's first action:

```ts
await page.getByRole("region", { name: "Tasks closed per week" })
  .comment("The chart follows the filter: active work is picking up every week.")
  .zoomIn()
  .hover();

await page.getByRole("button", { name: "Save view" })
  .comment("To come back to it later, save it as a view.")
  .zoomOut()                 // chained: happens after this click
  .click();
```

`zoomIn` holds the camera until `zoomOut`, across steps and clicks. If you wrote a standalone `zoomOut()` before
that click, it would happen before the chart's comment had finished. See [Direct the picture](../guide/picture.md).

## 6. Point with an overlay instead

A callout is often clearer than a zoom: a spotlight on the element and a bubble that explains it. Write the comment
first and the overlay after it. The comment explains, and the overlay points:

```ts
comment("The chart follows the filter: active work is picking up every week.");
await page.getByRole("region", { name: "Tasks closed per week" })
  .callout("The chart follows the filter", { detail: "Active projects only" });
```

A lower third titles what is on screen, and a highlight shows the spotlight with no bubble:

```ts
await lowerThird({ title: "Projects", subtitle: "Every project this quarter" });
await page.getByRole("link", { name: "Active work" }).highlight();
```

See [Overlays](../guide/overlays.md).

## 7. Open and close with cards

Cards are designed screens inserted into the video. The app pauses on its frame, the card plays, and the app resumes
where it left off. A comment written just before a card is spoken over it, and the card stays until it ends:

```ts
comment("Orbit 2.4 brings saved views: your filters, one click away.");
await card.intro({ kicker: "Orbit 2.4", title: "Saved views", subtitle: "Your filters, one click away" });

await card.chapter({ title: "Filter the projects" });     // "Chapter 01 / 02", numbered by itself
// ...
await card.outro({ title: "Try saved views", url: "orbit.dev/views", links: ["Docs", "Changelog"] });
```

See [Cards](../guide/cards.md) for features, screenshots, before-and-after and custom HTML cards.

## 8. Put your brand on it

Every card and overlay follows the brand set in `flow-reel.json`, next to the script:

```json
{
  "version": 1,
  "voice": { "adapter": "openai", "model": "gpt-4o-mini-tts", "speaker": "coral", "apiKeyEnv": "OPENAI_API_KEY" },
  "brand": { "theme": "ink", "accent": "#6366F1" }
}
```

See [Brand](../guide/brand.md) for logos and fonts.

## 9. The whole script

Put together, this is the script of the [showcase reel](../demos.md):

```{literalinclude} ../demos/orbit-tour/script.ts
:language: ts
```

## 10. Compose, check, change

```sh
npx flow-reel compose tour.ts       # writes tour.reel/
npx flow-reel verify tour.reel      # every file present and unaltered
```

Watch `tour.reel/video.mp4`, then read `tour.reel/transcript.json`. Each step's `startMs` and `endMs` show how long
it took. If a step is much longer than its actions, its comment is too long for what is on screen, so shorten it.

Composing again reuses every unchanged comment's speech. If the app's data changed between runs (a duplicated saved
view, for example), reset it before composing. The page's clock and random seed are fixed, but your server isn't.

To check that a new compose still matches an old one (same steps, comments, voice and effects, each step starting
within ±150 ms):

```sh
cp -r tour.reel /tmp/tour-before.reel
npx flow-reel compose tour.ts
npx flow-reel compare /tmp/tour-before.reel tour.reel
```

## Next

- [Make reels with Claude](with-claude.md): let an agent do all of this from one sentence.
- [A launch video](launch-video.md): a release announcement with screenshots and a before-and-after.
- [Script API](../reference/script-api.md): every word on one page.

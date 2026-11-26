# Scripts

A **script** is a file in the workspace's scripts folder, named `<name>.reel.ts` (or `.reel.js`), whose default export is
`script(options, body)`. The body is plain Playwright,
plus the flow-reel words. Every word can stand alone, called from the body's context, or be chained on the element it
is about.

```ts
// reels/settings.reel.ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, comment }) => {
  comment("Open the settings page.");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Dark mode")
    .comment("Turn on dark mode.")
    .sound(Sounds.controls.TOGGLE)
    .check();
});
```

## Options

| Option | Meaning | Default |
|---|---|---|
| `url` | Where the script starts. `localhost` reaches the app running on your machine. | required |
| `viewport` | `[width, height]` in whole CSS pixels. | `[1920, 1080]` |
| `autoZoom` | `false` turns automatic zoom off. The cursor, ripples and `zoomIn` stay. | `true` |

## The body's context

The body receives `page` (a Playwright `Page`) and the standalone words: `comment`, `sound`, `flash`, `zoomIn`,
`zoomOut`, `speedUp`, `skip`, `card` and `lowerThird`. Take only the ones you use:

```ts
export default script({ url }, async ({ page, comment, card, speedUp }) => { /* ... */ });
```

Locators gain the chained words: `.comment()`, `.sound()`, `.flash()`, `.zoomIn()`, `.zoomOut()`, `.callout()` and
`.highlight()`.

## Steps and comments

A **comment** is a spoken line. It opens a **step**: the step starts with the next action and takes in every action
until the next comment.

- `comment(text)` returns at once, so don't `await` it.
- Chained, `locator.comment(text)` opens the step at that element's next action.
- Two comments with no action between them make two steps, the first with no action. It is still spoken.
- Actions before the first comment form a step with no comment.
- The video holds a step's last frame until its comment has been spoken, plus 200 ms, so speech is never cut.
- A blank comment adds no speech and no caption.

## Actions that move the pointer

These actions move a visible pointer to their target, scrolling it into view first: clicks (including their
`button` and `position` options), double-clicks, `hover`, `check`, `fill`, `type`, `pressSequentially` and
`selectOption`.

- Typing, including `page.keyboard.type`, runs at a fixed, readable 60 ms per character. A `delay` passed to a
  typing call is replaced. `timeout` and `force` are kept.
- `fill(value)` clicks the field, clears it and types the value visibly, so a long value takes time on screen. The
  click can trigger the field's own click behaviour.
- Date, time, month, week, color and range inputs can't be typed into: they are filled directly after the pointer
  reaches them.
- `page.mouse.wheel` scrolls smoothly.
- Locators from `getBy*`, chaining, `locator.all()` and frame locators behave the same way.

Other calls run as they are, with no pointer motion, and print a warning once per method: `press`,
`page.keyboard.press`, `page.evaluate`, `locator.dispatchEvent` and `page.frame()` (its frames aren't animated). Like
`goto`, `reload`, `goBack` and `goForward`, they still count as actions of their step. Where the viewer should see
an action, prefer a pointer action (`click`, `fill`).

## Waiting

After a step's last action, the composer waits for network quiet (500 ms with no requests, at most 10 s), then
captures another 100 ms. A timeout prints a warning and goes on.

Network quiet doesn't prove your app has finished. **Wait for the visible result yourself** before marking it with a
sound or moving on:

```ts
await page.getByRole("button", { name: "Save" }).click();
await page.getByRole("status").filter({ hasText: "saved" }).waitFor();
sound(Sounds.feedback.SUCCESS);
```

Don't add sleeps. For waits longer than a few seconds, use [`speedUp` or `skip`](picture.md#long-waits).

## Fixed so every compose is the same

The composer fixes the viewport, the device scale, `prefers-reduced-motion`, the page's clock
(`2026-01-05T09:00:00Z`) and `Math.random`'s seed. Two composes of one script have the same steps, each starting
within ±150 ms.

The browser is fresh on every compose, with no cookies, storage or login. Your app's server isn't fixed, though: reset
data a previous run created before composing again.

## Rules for script files

- **Erasable TypeScript only:** no `enum`, `namespace` or parameter properties. Scripts run with Node's type
  stripping.
- **The name** ends in `.reel.ts` or `.reel.js`. Other files in the scripts folder are helpers. Two scripts that would
  give the same reel are refused. Scripts can be in subfolders: `reels/admin/refund.reel.ts` gives
  `reels/out/admin/refund.reel/`.
- **Imports:** only from `flow-reel` and from files in the scripts folder. A run works on its own copy of that folder,
  the only one the composer sees, so every image, card page, logo and font must live in it too.
- A bad option throws where the word is written, naming it.

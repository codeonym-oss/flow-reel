# Overlays

Overlays are drawn over the app while it runs. A **callout** or a **highlight** points at an element, and a **lower
third** titles what is on screen.

```ts
comment("Saved views are new in Orbit 2.4.");
await lowerThird({ title: "Saved views", subtitle: "New in Orbit 2.4" });

comment("The chart follows whichever view you pick.");
await page.getByTestId("chart").callout("The chart follows the filter", { detail: "Pick a view to see it change" });

await page.getByRole("button", { name: "Share" }).highlight();
```

| Word | Options | Drawn |
|---|---|---|
| `await locator.callout(text, options?)` | `detail?`, `ms?`, `theme?` | A spotlight on the element and a bubble beside it, below or above. |
| `await locator.highlight(options?)` | `ms?`, `theme?` | The spotlight alone. |
| `await lowerThird({ title, … })` | `subtitle?`, `ms?`, `theme?` | A bar at the bottom left of the screen. |

## How long they show

Each overlay is awaited: the script waits `ms` (1.5 s by default) with it shown. It then stays until the script's
next action, through the hold that lets its step's comment finish. So a callout written after its comment stays up
while the line is spoken.

**Write the comment first and the overlay right after.** The comment explains, and the overlay points.

## The camera

- While a callout or a highlight shows, the camera shows the whole screen, then zooms again after.
- A lower third is drawn on the screen, not on the app, so the camera goes on as before under it.

## Rules

- An element that isn't on screen is scrolled into view first.
- An overlay stops where a card starts.
- Overlays can't go inside `speedUp` or `skip`.
- They follow the [brand](brand.md)'s theme and accent, unless they set their own `theme`.
- The event log records each as an `overlay` event, with its words, its element's box and how long it showed.
  `compare` checks everything but how long.

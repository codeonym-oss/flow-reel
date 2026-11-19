# Script API

Everything a script can say, for the version of flow-reel these docs belong to. If a word, option or flag isn't on this page, flow-reel
doesn't have it.

```ts
import { script, Sounds } from "flow-reel";
import type { ScriptContext, ScriptOptions, Sound, Brand } from "flow-reel";
```

## `script(options, body)`

The default export of every script file.

| Option | Type | Default | |
|---|---|---|---|
| `url` | `string` | required | Where the script starts. `localhost` is the machine running the compose. |
| `viewport` | `[width, height]` | `[1920, 1080]` | Whole CSS pixels. |
| `autoZoom` | `boolean` | `true` | `false` turns automatic zoom off. |

`body` is `async (context) => { … }`, where `context` is a `ScriptContext`:

| Member | Kind | Page |
|---|---|---|
| `page` | Playwright `Page` | [Scripts](../guide/scripts.md) |
| `comment(text)` | standalone, not awaited | [Steps and comments](../guide/scripts.md#steps-and-comments) |
| `sound(Sounds.…)` | standalone, not awaited | [Sounds](../guide/sounds.md) |
| `flash(options?)` | standalone, not awaited | [Effects](../guide/picture.md#effects) |
| `zoomIn(options?)`, `zoomOut(options?)` | standalone, not awaited | [Zoom](../guide/picture.md#zoom) |
| `speedUp(factor, fn)` | awaited | [Speed up a wait](../guide/picture.md#speed-up-a-wait) |
| `skip(fn, options?)` | awaited | [Skip a wait](../guide/picture.md#skip-a-wait) |
| `card.*` | awaited | [Cards](../guide/cards.md) |
| `lowerThird({ … })` | awaited | [Overlays](../guide/overlays.md) |

## Chained on a locator

Every Playwright locator (from `getBy*`, `locator()`, chaining, `all()` and frame locators) also has:

| Word | Returns | When |
|---|---|---|
| `.comment(text)` | the locator | opens a step at the locator's next action |
| `.sound(Sounds.…)` | the locator | plays with the locator's next action |
| `.flash(options?)` | the locator | when the action happens |
| `.zoomIn(options?)` | the locator | as the pointer heads for the element |
| `.zoomOut(options?)` | the locator | after the action |
| `.callout(text, options?)` | `Promise<void>` | now, until the next action |
| `.highlight(options?)` | `Promise<void>` | now, until the next action |

The chained words that return the locator can be combined in any order before the action:

```ts
await page.getByRole("button", { name: "Save" }).comment("Save it.").sound(Sounds.feedback.SUCCESS).zoomIn().click();
```

## Effects

| Word | Option | Values | Default |
|---|---|---|---|
| `flash` | `color` | `#rrggbb` | `"#ffffff"` |
| | `ms` | fade-out length | `250` |
| `zoomIn` | `scale` | 1 to 2 | `4/3` |
| | `ms` | ease-in length | `650` |
| `zoomOut` | `ms` | ease-out length | `800` |
| `speedUp` | `factor` | above 1, at most 16 | required |
| `skip` | `label` | text, `{duration}` shows the length cut | `"{duration} skipped"` |
| | `style` | `"clock"`, `"bar"` | `"clock"` |

## Sounds

| Constant | |
|---|---|
| `Sounds.feedback.SUCCESS`, `.ERROR`, `.NOTIFICATION` | outcomes |
| `Sounds.navigation.OPEN`, `.CLOSE`, `.BACK` | panels, dialogs, pages |
| `Sounds.controls.TOGGLE`, `.SELECT` | switches, choices |

## Cards

| Word | Props |
|---|---|
| `card.intro({ … })` | `title`, `kicker?`, `subtitle?`, `layout?: "left" \| "center"` |
| `card.chapter({ … })` | `title`, `subtitle?` |
| `card.feature({ … })` | `title`, `points` (1 to 5), `kicker?`, `image?`, `imageSide?: "right" \| "left"` |
| `card.image(image, { … }?)` | `kicker?`, `title?`, `caption?`, `frame?: "browser" \| "phone" \| "none"`, `fit?: "cover" \| "contain"`, `url?` |
| `card.compare({ … })` | `before`, `after`, `kicker?`, `title?`, `labels?: [string, string]` |
| `card.outro({ … })` | `title`, `url?`, `links?` (up to 4) |
| `card.custom(page, props?, options?)` | any JSON props |

Every card's options: `ms` (500 to 60000), `enter` and `exit` (`fade`, `slide`, `wipe`, `zoom`, `blur`, `iris`,
`cut`), `theme` (`ink`, `paper`, `ocean`, `ember`).

## Overlays

| Word | Options |
|---|---|
| `locator.callout(text, { … }?)` | `detail?`, `ms?` (default 1500), `theme?` |
| `locator.highlight({ … }?)` | `ms?`, `theme?` |
| `lowerThird({ title, … })` | `subtitle?`, `ms?`, `theme?` |

## What can go where

| Inside | Allowed | Throws |
|---|---|---|
| `speedUp(fn)` | actions, sounds, `flash`, zoom | `comment`, cards, overlays, `speedUp`, `skip` |
| `skip(fn)` | actions, sounds | `comment`, cards, overlays, `flash`, zoom, `speedUp`, `skip` |

## Exported types

`Script`, `ScriptOptions`, `ScriptContext`, `ScriptBody`, `Sound`, `FlashOptions`, `ZoomInOptions`,
`ZoomOutOptions`, `SkipOptions`, `Cards`, `CardOptions`, `CardProps`, `IntroCard`, `ChapterCard`, `FeatureCard`,
`ImageCard`, `CompareCard`, `OutroCard`, `OverlayOptions`, `CalloutOptions`, `LowerThird`, `Brand`, `BrandFonts`,
`ThemeName`, `Transition`.

## Retired

`showFrame(image, ms)` was replaced by `card.image` in 0.5. Calling it fails, naming the replacement. See
[Migration](../migration.md).

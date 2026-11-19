# Migration

## From 0.4 to 0.5

0.5 adds [cards](guide/cards.md), [overlays](guide/overlays.md) and the [brand](guide/brand.md), and retires
`showFrame`: a script calling it fails, naming `card.image`.

| 0.4 | 0.5 |
|---|---|
| `await showFrame("diagram.png", 3000)` | `await card.image("diagram.png", { frame: "none", fit: "contain", ms: 3000 })` |
| `showFrame(…, { background: "#1b1f2a" })` | the card's `theme`, or the brand's |
| the skip card, dimmed, with "⏭ 38 s skipped" | the skip card in the brand's theme, `style: "clock"` or `"bar"` |
| event log version 5, `frame` events | event log version 6: `card` events, and the skip's `style` |

## From 0.1 to 0.2

0.2 replaces the 0.1 script words. A 0.1 script fails to load, with a pointer here.

| 0.1 | 0.2 |
|---|---|
| `import { demo } from "flow-reel"` | `import { script, Sounds } from "flow-reel"` |
| `demo(options, async ({ page, step, sfx }) => …)` | `script(options, async ({ page, comment, sound }) => …)` |
| `await step("Save.", () => button.click())` | `comment("Save."); await button.click()` or `await button.comment("Save.").click()` |
| `sfx("success")` | `sound(Sounds.feedback.SUCCESS)` or `button.sound(Sounds.feedback.SUCCESS)` |
| `npx flow-reel record demo.ts` | `npx flow-reel compose demo.ts` |
| `--no-sfx` | `--no-sound` |
| transcript version 1, step field `narration` | transcript version 2, step field `comment`, and `voice.language` |
| the voice was always Ryan in English | `--speaker`, `--language` or `flow-reel.json` ([Configure the composer](guide/configuration.md)) |
| event log versions 1 and 2, event `{ type: "sfx" }` | event log version 4, event `{ type: "sound" }`, plus effect events and `autoZoom` |
| `demo.mp4`, `demo.transcript.json`, … beside the script, work files in `.flow-reel/` | one folder, `demo.reel/` (delete old `.flow-reel/` folders) |
| `flow-reel compare a.transcript.json b.transcript.json` | `flow-reel compare a.reel b.reel` |

0.3 added [cloud voices](guide/voices.md#cloud-voices), and 0.4 added `speedUp` and `skip`. Neither changed
existing scripts.

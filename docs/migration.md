# Migration

## From 0.7 to 0.8

0.8 makes a project a **workspace** and a compose a **run**. The words in a script haven't changed.

1. **Make the project a workspace.** In its root, run `npx flow-reel init`. It takes over the voice and brand of your
   0.7 `flow-reel.json`, removes it, and names the folder your scripts are in. With several 0.7 files, `init` names them
   and stops: keep one, and pass the others' voices as flags.
2. **Rename the scripts** to `<name>.reel.ts`. `init` prints the `git mv` lines.
3. **Look for reels in the output folder**, `<scripts folder>/out/` by default. Move the ones you have there before you
   compose, so that their clips are reused, and change the paths your CI and pages use.
4. **Remove what 0.7 left:** `work/` in each reel, and any `*.reel.partial/` folder. 0.8 writes neither.

| 0.7 | 0.8 |
|---|---|
| `demos/tour.ts` | `demos/tour.reel.ts` |
| `demos/flow-reel.json`, one per folder | `flow-reel.json`, one at the project's root, with `scripts: "demos"` |
| the first compose writes `flow-reel.json` | `init` writes it; `--save-config` updates it |
| `demos/tour.reel/` | `demos/out/tour.reel/` |
| brand paths relative to `flow-reel.json` | relative to the scripts folder (`init` changes them) |
| a script reads its own folder | a script reads the whole scripts folder |
| `tour.reel.partial/` after a failure | nothing in the project; `flow-reel logs tour`, `flow-reel resume tour` |
| `work/` in the reel | in the [run](guide/runs.md#where-runs-are), in flow-reel's data folder |
| closing the terminal ends the compose | it goes on; Ctrl+C cancels it |
| exit 1 for everything that fails | 1 failed, 3 stopped, 4 cancelled ([exit codes](reference/cli.md#exit-codes)) |

Reels made by 0.7 still verify and compare. The transcript, event log and manifest formats haven't changed.

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

# flow-reel

**Turn a Playwright script into a narrated, polished demo video, the same way every time.**

You write the walkthrough of a feature as an ordinary Playwright script, and add a few flow-reel words: **comments**
to speak, **sounds** to play, **effects**, **cards** and **overlays** for the picture. The **composer**, a container
image, replays the script in a fresh browser, records the screen and speaks your comments. It then polishes the
picture with a smooth cursor, click ripples and zoom.

The result is a **reel**: one folder with the video, captions, a transcript, the audio and a manifest. Change one line
and compose again, and only that line is spoken again.

```{raw} html
<video controls preload="metadata" poster="_static/demos/orbit-tour.jpg" style="width:100%;border-radius:12px">
  <source src="_static/demos/orbit-tour.mp4" type="video/mp4">
  <track kind="captions" src="_static/demos/orbit-tour.vtt" srclang="en" label="English" default>
</video>
```

<p style="text-align:center"><em>A reel composed by flow-reel from <a href="demos/">a short script</a>:
cards, a lower third, a callout, sounds and automatic zoom.</em></p>

```ts
// reels/settings.reel.ts
import { script, Sounds } from "flow-reel";

export default script({ url: "http://localhost:4173" }, async ({ page, comment, card }) => {
  comment("Dark mode is here.");
  await card.intro({ kicker: "Release 2.4", title: "Dark mode" });

  comment("Open the settings page.");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Dark mode")
    .comment("Turn on dark mode, and the whole app follows.")
    .sound(Sounds.controls.TOGGLE)
    .check();
});
```

```sh
export OPENAI_API_KEY=...                                   # a cloud voice: fast, recommended
npx flow-reel init --title "My app"                         # once: makes the project a workspace
npx flow-reel compose reels/settings.reel.ts --voice openai # writes reels/out/settings.reel/
```

## Why flow-reel

- **Videos as code.** A reel is built from a script in your repository. Review it in a pull request, and compose it
  again when the UI changes, instead of recording the whole thing again.
- **Narration that fits.** Each comment is spoken over its step. The video holds the frame until the line is
  finished, so speech is never cut off or rushed.
- **Polished by default.** A drawn cursor glides between targets, clicks ripple, and the camera zooms in on what you
  touch, with no editing.
- **Designed screens.** [Cards](guide/cards.md) (intro, chapters, features, screenshots, before and after, outro, or
  your own HTML) and [overlays](guide/overlays.md) (callouts, highlights, lower thirds), all in your
  [brand](guide/brand.md).
- **Long waits, handled.** [`speedUp`](guide/picture.md#speed-up-a-wait) fast-forwards a wait;
  [`skip`](guide/picture.md#skip-a-wait) cuts it and says how long was cut.
- **Deterministic.** A fixed viewport, clock and random seed, in a pinned container. Composing again gives a matching
  reel, and [`flow-reel compare`](guide/reels.md#compare-two-reels) proves it.
- **Runs you can leave.** A compose goes on when its terminal closes, can be watched or cancelled from another one,
  and [resumes](guide/runs.md) after a crash without recording again.
- **Agent-ready.** A [plugin for Claude Code and Codex](tutorials/with-claude.md) teaches an agent to plan, write,
  compose and review reels for you.

## Pick a voice

:::{tip}
**Use a cloud voice.** OpenAI, Gemini, OpenRouter, Together AI, Groq, ElevenLabs or any OpenAI-compatible server
speaks a whole script in seconds. The built-in local voice runs on your CPU and takes about a minute a comment.
**Qwen3-TTS 0.6B is the only built-in local voice today**; any other self-hosted voice can be used through
`openai-compatible`, if its server speaks OpenAI's speech API. See [Voices](guide/voices.md).
:::

## Where to start

[Quickstart](getting-started/quickstart.md)
: Install flow-reel and compose a first reel in about five minutes.

[Your first reel](tutorials/first-reel.md)
: A full tutorial: plan a story, write the script step by step, compose, review and change it.

[Make reels with Claude](tutorials/with-claude.md)
: Install the plugin and ask Claude Code for a demo video. It plans the reel, writes and composes it, then reviews
  the result.

[Use cases](use-cases.md)
: Release videos, onboarding tours, pull request demos, docs walkthroughs, localized reels.

[Script API](reference/script-api.md)
: Every word, option and default on one page.

```{toctree}
:hidden:
:caption: Getting started

getting-started/installation
getting-started/quickstart
demos
use-cases
```

```{toctree}
:hidden:
:caption: Tutorials

tutorials/first-reel
tutorials/with-claude
tutorials/launch-video
```

```{toctree}
:hidden:
:caption: Guide

guide/scripts
guide/picture
guide/cards
guide/overlays
guide/brand
guide/sounds
guide/voices
guide/configuration
guide/runs
guide/reels
```

```{toctree}
:hidden:
:caption: Recipes

recipes/check-reels-in-ci
recipes/localized-reels
recipes/embed-a-reel
```

```{toctree}
:hidden:
:caption: Reference

reference/script-api
reference/cli
reference/settings
reference/reel-format
troubleshooting
```

```{toctree}
:hidden:
:caption: Project

migration
changelog
releasing
```

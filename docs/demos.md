# Demos

## Orbit: saved views

```{raw} html
<video controls preload="metadata" poster="../_static/demos/orbit-tour.jpg" style="width:100%;border-radius:12px">
  <source src="../_static/demos/orbit-tour.mp4" type="video/mp4">
  <track kind="captions" src="../_static/demos/orbit-tour.vtt" srclang="en" label="English" default>
</video>
```

A 31-second reel of **Orbit**, the small example app in flow-reel's repository, composed by flow-reel 0.5.0 with the
built-in local voice (Ryan, English) and an `ink` brand with an indigo accent. Nothing in it was edited by hand.

What's in it:

| Time | Step | flow-reel words |
|---|---|---|
| 0:00 | Intro, "Orbit 2.4 brings saved views…" | `card.intro`, with its comment spoken over it |
| 0:10 | Chapter 1, the projects, filtered to active ones | `card.chapter`, `lowerThird`, `.sound(TOGGLE)`, automatic zoom on the click |
| 0:15 | The chart follows the filter | `.callout(…)`: a spotlight and a bubble, with the camera on the whole screen |
| 0:21 | Chapter 2, saving the view | `card.chapter`, `.comment()` chained on the button, `.sound(OPEN)`, visible typing |
| 0:26 | The view in the sidebar | `sound(SUCCESS)` after the toast, `.highlight()` |
| 0:31 | Outro | `card.outro` |

```{image} _static/demos/orbit-tour-sheet.png
:alt: A contact sheet of the reel, one frame every 2.5 seconds
```

### The script

```{literalinclude} demos/reels/orbit-tour.reel.ts
:language: ts
```

```{literalinclude} demos/flow-reel.json
:language: json
:caption: flow-reel.json
```

### Compose it yourself

```sh
git clone https://github.com/codeonym-oss/flow-reel.git && cd flow-reel
npm ci && npm run build
node plugin/examples/saved-views/serve.mjs &           # Orbit on http://localhost:4173/
node dist/cli.js compose docs/demos/reels/orbit-tour.reel.ts --out /tmp/reels
```

With the built-in local voice this compose took a little over 9 minutes on an 8-core laptop, of which 5½ minutes
were speech for the five comments, at 5.5 GiB peak memory. With a cloud voice, the speech takes seconds:

```sh
export OPENAI_API_KEY=...
node dist/cli.js compose docs/demos/reels/orbit-tour.reel.ts --out /tmp/reels --voice openai
```

## The worked example

[`plugin/examples/saved-views/`](https://github.com/codeonym-oss/flow-reel/tree/main/plugin/examples/saved-views)
is the agent plugin's worked example of the same feature, without cards: a brief explaining every choice, the
script, and the settings. It's the reel [the tutorial](tutorials/first-reel.md) builds in its first steps.

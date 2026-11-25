# The flow-reel language

flow-reel turns a **script** into a **reel**. A person or an agent writes the script; the **composer** compiles
it, the same way every time.

This file is the project's vocabulary. Use these words, with these meanings, in code, documentation, commit
messages, issues and the plugin. Each concept has one word; the "avoid" words are older or looser names for it.

> **Status:** this is the 0.2 language, with cards (GH-76) and workspaces (GH-108). Scripts use it (`script`, `comment`, `sound`, the effects
> `flash`, `zoomIn`, `zoomOut`, `speedUp` and `skip`, the `card` words, `flow-reel compose`), and a compose writes a
> reel. `showFrame` was retired for `card.image` in 0.5.

## Where the work lives

**Workspace**
A project made ready for flow-reel with `flow-reel init`: one `flow-reel.json` at its root gives it an id, a slug and a
title, and says where its scripts and reels are. Two checkouts of a project are the same workspace.
_Avoid:_ project (the person's app and its code), repository.

**Scripts folder**
The one folder of a workspace that holds its scripts and everything they use: helpers, images, card pages, the brand's
logo and fonts. A running script can read nothing else. `reels/` unless the workspace says otherwise.

**Output folder**
Where a workspace's finished reels go: `reels/out/` unless the workspace, or one compose, says otherwise.

**Alias**
A name for a workspace on one computer, used when another workspace there has the same slug.

**Data folder**
flow-reel's own folder on the person's computer, outside every project. Runs live there.
_Avoid:_ app data, cache.

## What a person writes

**Script**
The file a person or an agent writes: the E2E tool's own script, plus flow-reel words. It is named `*.reel.ts` or
`*.reel.js`; its **name** is its path in the scripts folder without that ending, such as `admin/refund`.
_Avoid:_ scenario, flow, demo.

**Step**
One action in a script, together with whatever is attached to it.
_Avoid:_ phase.

**Comment**
A spoken line. The composer turns it into voice audio and a caption.
_Avoid:_ narration.

**Sound**
A short sound effect placed at a moment.
_Avoid:_ audio, SFX.

**Effect**
A change to the picture written in the script: a flash (`flash`), a zoom in or out (`zoomIn`, `zoomOut`), a speed-up
(`speedUp`), a skip (`skip`). An explicit zoom holds the camera until the zoom out.
_Avoid:_ visual effect, SFX.

**Speed-up**
A stretch of the script, wrapped in `speedUp(factor, …)`, that plays faster in the reel, with a badge showing the
factor. Only actions go inside it.
_Avoid:_ fast-forward, time-lapse, play speed.

**Skip**
A stretch of the script, wrapped in `skip(…)`, cut from the reel and replaced by a card saying how long was cut. Only
actions go inside it.
_Avoid:_ cut, jump, time skip.

Comment, sound and effect are the three families of flow-reel words. Each can stand alone in a script or be chained
on the element it is about. Cards are the fourth: they stand alone. Overlays are the fifth: a callout and a highlight
chain on their element, and a lower third stands alone.

**Card**
A designed screen the composer inserts into the reel where the script awaits it: an intro, a chapter, a feature, an
image, a before and after, an outro, or a custom card. The app stops on its frame, the card plays with a transition in and out, and the app resumes where it
left. The skip card is a card too.
_Avoid:_ slide, title screen, frame (a frame is one picture of the video).

**Custom card**
A card the person writes as an HTML page in the scripts folder, with its own CSS, JavaScript, images and fonts, and
shows with `card.custom(page, props)`.
_Avoid:_ template, component.

**Overlay**
Something drawn over the app while it runs, from where the script awaits it until the script's next action: a callout
or a highlight on an element (`locator.callout`, `locator.highlight`), drawn on the app so it moves with the camera,
or a lower third (`lowerThird`), drawn on the screen.
_Avoid:_ annotation, tooltip, badge (the speed-up's).

**Transition**
How a card comes in or goes out: `fade`, `slide`, `wipe`, `zoom`, `blur`, `iris` or `cut`.
_Avoid:_ animation (what moves inside a card).

**Brand**
How a reel's cards and overlays look, set once in `flow-reel.json`: the theme, an accent colour, a logo, fonts and the default
transitions.
_Avoid:_ style, skin.

**Theme**
One of the colour sets a card is drawn in: `ink`, `paper`, `ocean` or `ember`.
_Avoid:_ palette, colour scheme.

## What compiles it

**Composer**
The container image that compiles a script into a reel. The verb is **compose**. It comes as the **full image**, which
has the local voice, and the smaller **cloud image**, for a cloud voice; the voice picks which one composes.
_Avoid:_ runner, recorder.

**Run**
One compose of one script, from start to end: its request, its copy of the scripts folder, its phases' results and its
reel, in one numbered folder of the data folder. A run works on one version of the scripts, whatever changes meanwhile.
_Avoid:_ job, build, session, execution.

**Phase**
One part of a run: **record** replays the script and captures it, **voice** speaks the comments, **plan** decides the
timeline, **render** makes the video, **publish** puts the reel in the output folder. Each reads earlier results and
leaves its own.
_Avoid:_ stage, stretch (a sped-up or skipped part of a script).

**State**
What a run is doing now: **queued**, **running**, **held** (waiting for a person), or ended: **done**, **failed** (an error in
the script, the app, the voice or the render), **stopped** (it ended without an error and without finishing) or
**cancelled** (a person ended it).
_Avoid:_ status, interrupted.

**Journal**
Everything that happened to a run, one entry at a time, appended and never changed. The entries in order are the run.
`journal.jsonl` in a run.
_Avoid:_ log (a run's log is what its containers and its script print).

**Gate**
A point where a run can be held: before each phase, and before each step while it records.
_Avoid:_ breakpoint, checkpoint.

**Heavy work**
A recording, a render or a local voice. Runs do it in **turns**, one at a time on a computer, in the order they asked.
_Avoid:_ slot, lease.

**Result**
What a phase leaves in its run, complete or not there at all, and what it was made from.
_Avoid:_ artifact, output.

**Cue sheet**
What recording a script produced besides the capture: its steps and its events, timed. Later phases read it and never the
script. `cues.json` in a run.

**Integration**
The adapter between the composer and one E2E tool, such as Playwright.
_Avoid:_ driver.

**Voice**
The speech model that speaks comments. It may be local or a cloud service.
_Avoid:_ TTS, transcription model.

**Settings**
Which integration and voice the composer uses, and the voice's speaker and language. They come from flags, then the
workspace's `flow-reel.json`, then the defaults.
_Avoid:_ options (a script's own options, such as `url` and `autoZoom`).

**Recording**
The raw screen capture the composer makes while the integration replays the script, kept in the run. It is an
intermediate, not the result.
_Avoid:_ using "recording" for the finished video or for the act of composing.

**Polish**
The picture treatment the composer applies by default, without any word in the script: the drawn cursor, click
ripples, zoom on click and following the cursor. An effect in the script overrides it, and `autoZoom: false` turns
its zoom off.

**Insertion**
Frames the composer puts into the video's timeline that the recording doesn't have: a hold, which repeats a frame so
a comment can finish, or a card. The recording resumes on the frame it left.

**Port**
A boundary of the composer's core that has more than one possible implementation. There are four: integration,
voice, reel store and card painter.

**Card painter**
What draws a card's or an overlay's page frame by frame, on a frozen clock, with the network off. Today it is a headless Chromium.

**Reel store**
Where a reel is written and read. Today it is a folder.

## What comes out

**Reel**
The whole compiled result of one script: one folder holding the video, the transcript, the captions, the event log,
the audio and the manifest.
_Avoid:_ cassette, output, take.

**Manifest**
The file in a reel that lists what the reel contains and how it was composed.

**Transcript**
The timed text of the comments, inside the reel.

**Captions**
The comments as subtitle files, timed from the transcript.

**Event log**
The timed record of what happened on screen while composing: pointer movement, clicks, typing, sounds and effects.
Polish and effects are rendered from it.

**Reel cache**
The voiced comments kept with a reel, so composing an unchanged comment again reuses its audio instead of
asking the voice for it. It is the previous reel's clips, copied into the run: one is reused when its comment and the voice's settings
are the same and the clip still matches its hash.

## What teaches it

**Plugin**
The skills and references that teach an agent this language: what to use, when, how and why.

## How the terms relate

- A **workspace** has one **scripts folder** and one **output folder**; a **script** gives one reel.
- A **script** is made of **steps**. A step can carry **comments**, **sounds** and **effects**, and show **cards**.
- A card follows the **brand**: its **theme** and its **transitions**, unless the card sets its own. An **overlay**
  follows its theme too.
- The **composer** composes one script into one **reel**.
- The composer replays the script through an **integration** and speaks its comments with a **voice**.
- Composing a script is one **run**, made of **phases**. While replaying, the composer makes a **recording** and a **cue
  sheet**. It then applies **polish** and the script's effects to produce the reel's video and its **event log**.
- A reel holds the video, the **transcript**, the **captions**, the event log, the audio and the **manifest**.
- The same script, with the same **reel cache**, composes to the same reel.
- The **plugin** teaches an agent to write scripts. It contains no composing logic.

## In use

> "The script comments on the login step and adds a success sound. Composing it with the local voice gives a
> reel whose transcript has two comments."

> "Zoom on click is polish, so the script doesn't ask for it. This step needs the camera on the chart, so it
> carries a zoom effect, which overrides the polish for that step."

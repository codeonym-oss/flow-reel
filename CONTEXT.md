# The flow-reel language

flow-reel turns a **script** into a **cassette**. A person or an agent writes the script; the **composer** compiles
it, the same way every time.

This file is the project's vocabulary. Use these words, with these meanings, in code, documentation, commit
messages, issues and the plugin. Each concept has one word; the "avoid" words are older or looser names for it.

> **Status:** this is the 0.2 language. Scripts use it (`script`, `comment`, `sound`, `flow-reel compose`). Until
> [#31](https://github.com/codeonym-oss/flow-reel/issues/31) lands, a cassette is still loose files next to the
> script rather than one folder with a manifest, and effects arrive with
> [#32](https://github.com/codeonym-oss/flow-reel/issues/32).

## What a person writes

**Script**
The file a person or an agent writes: the E2E tool's own script, plus flow-reel words.
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
A change to the picture written in the script: a flash, a shown frame, a zoom in or out.
_Avoid:_ visual effect, SFX.

Comment, sound and effect are the three families of flow-reel words. Each can stand alone in a script or be chained
on the element it is about.

## What compiles it

**Composer**
The container image that compiles a script into a cassette. The verb is **compose**.
_Avoid:_ runner, recorder.

**Integration**
The adapter between the composer and one E2E tool, such as Playwright.
_Avoid:_ driver.

**Voice**
The speech model that speaks comments. It may be local or a cloud service.
_Avoid:_ TTS, transcription model.

**Recording**
The raw screen capture the composer makes while the integration replays the script. It is an intermediate, not the
result.
_Avoid:_ using "recording" for the finished video or for the act of composing.

**Polish**
The picture treatment the composer applies by default, without any word in the script: the drawn cursor, click
ripples, zoom on click and following the cursor. An effect in the script overrides it.

**Port**
A boundary of the composer's core that has more than one possible implementation. There are three: integration,
voice and cassette store.

**Cassette store**
Where a cassette is written and read. Today it is a folder.

## What comes out

**Cassette**
The whole compiled result of one script: one folder holding the video, the transcript, the captions, the event log,
the audio and the manifest.
_Avoid:_ output, take.

**Manifest**
The file in a cassette that lists what the cassette contains and how it was composed.

**Transcript**
The timed text of the comments, inside the cassette.

**Captions**
The comments as subtitle files, timed from the transcript.

**Event log**
The timed record of what happened on screen while composing: pointer movement, clicks, typing, sounds and effects.
Polish and effects are rendered from it.

**Cassette cache**
The voiced comments kept with a cassette, so composing an unchanged comment again reuses its audio instead of
asking the voice for it.

## What teaches it

**Plugin**
The skills and references that teach an agent this language: what to use, when, how and why.

## How the terms relate

- A **script** is made of **steps**. A step can carry **comments**, **sounds** and **effects**.
- The **composer** composes one script into one **cassette**.
- The composer replays the script through an **integration** and speaks its comments with a **voice**.
- While replaying, the composer makes a **recording** and an **event log**. It then applies **polish** and the
  script's effects to produce the cassette's video.
- A cassette holds the video, the **transcript**, the **captions**, the event log, the audio and the **manifest**.
- The same script, with the same **cassette cache**, composes to the same cassette.
- The **plugin** teaches an agent to write scripts. It contains no composing logic.

## In use

> "The script comments on the login step and adds a success sound. Composing it with the local voice gives a
> cassette whose transcript has two comments."

> "Zoom on click is polish, so the script doesn't ask for it. This step needs the camera on the chart, so it
> carries a zoom effect, which overrides the polish for that step."

# GH-6: The flow-reel plugin

Written for runtime 0.2.0 (re-plan, 2026-11-15). Decisions 005–011.

## Outcome

"Make a polished demo of saved views for a customer" gives a reel worth sharing: a clear story, a steady picture,
spoken lines that earn their time, sounds that mark real results, and an honest account of what was checked. The
agent explores the real app, writes a script in the 0.2 language, composes it, screens the reel and hands over the
folder with the command to compose it again.

## Skills

| Skill | Triggers on | Does | Stops when |
|---|---|---|---|
| `reel` | "make a demo / walkthrough / reel of …", a new feature to show | Brief (`story.md`) → explore (`exploring.md`) → script (`language.md`, `scenes.md`, `direction.md`, `comments.md`, `sound-design.md`, `shots.md`) → preflight → compose → screen (`screening.md`) → hand over. Picks up from an existing brief, script or reel. | The reel passes verify and screening, or a named blocker (app down, no replayable login). |
| `reshoot` | Feedback on an existing reel: "the zoom is rushed", "cut that line", "add a success sound", a changed UI | Keeps the current reel as `<name>.reel.before/` (copy, then `verify`), changes only the steps the feedback points at, composes, screens, compares with the before reel. | The feedback is met, or what blocks it is named (a feature the composer lacks is said as such). |
| `screening` | "check / review this reel", before sharing | `flow-reel verify`, `stills.mjs`, `compare` when two reels are given, the playback rubric. Writes findings; changes nothing. | Findings are written, with what was checked by files, by stills and by playback kept apart. |

Each skill's text is short: when to use it, the steps, which reference each step loads. Facts live in the
references, once. A client that can't invoke one skill from another reads the other's file and follows it.

## References (`plugin/references/`)

| File | Content | Loaded by |
|---|---|---|
| `language.md` | `script(options, body)`, `url`, `viewport`, `autoZoom`; `comment`, `sound`, `flash`, `showFrame`, `zoomIn`, `zoomOut`, standalone and chained, with options and defaults; `Sounds` groups; which Playwright calls move the pointer; erasable TypeScript, imports from `flow-reel` and the script's folder only; `compose`, `--out`, `--no-sound`, `--speaker`, `--language`, `--save-config`, `flow-reel.json`; `verify`, `compare`; the reel's files; **the supported range `>=0.2.0 <0.3.0`**. | all |
| `story.md` | Audience (reviewer, customer, learner), one takeaway, opening → change → payoff, what to cut; the brief's scene table. | `reel` |
| `scenes.md` | A scene is a few steps with one purpose: its starting state, viewport, short fixture text, what is on screen before the action (bounds are taken before it), waiting for the visible result, holding for reading. | `reel`, `reshoot` |
| `direction.md` | What polish does alone (cursor, ripples, zoom on click: 650 ms in, 2 s hold, 800 ms out, 4/3 cap); when an effect does better: `zoomIn` … `zoomOut` to hold the camera on a chart across steps, `flash` for a moment of emphasis, `showFrame` for a title or diagram card (an image the agent makes in the script's folder), `autoZoom: false` for a calm overview; above 4/3 the picture softens; pacing is measured, not set. | `reel`, `reshoot`, `screening` |
| `comments.md` | One idea per comment, benefit before mechanics, speakable text (numbers, acronyms), starting with the action; splitting long lines; speakers and languages; unchanged comments reuse their speech (reel cache). | `reel`, `reshoot` |
| `sound-design.md` | Clicks and typing are automatic; the eight sounds and what each means (`feedback.SUCCESS` after the success is visible, `ERROR`, `NOTIFICATION`, `navigation.OPEN`/`CLOSE`/`BACK`, `controls.TOGGLE`/`SELECT`); chained vs standalone timing; one sound per moment; a sound near a click replaces its click; pairing with `flash`; ducking under speech; `--no-sound` for a quiet cut. | `reel`, `reshoot`, `screening` |
| `shots.md` | Worked recipes, each a typechecked script fragment and why it works: the reveal, before and after, the saved form, an error and its recovery, the settings toggle, the title card. | `reel`, `reshoot` |
| `exploring.md` | Using the client's browser tool to find role/label locators and the states they lead to; recording loading and empty states; a login made while exploring doesn't reach the composer, which starts a fresh browser with only the script's folder mounted. | `reel` |
| `screening.md` | What `verify` proves (files whole) and doesn't; what `compare` proves (steps, comments, voice, effects within ±150 ms) and doesn't (pixels, sounds, MP4 bytes); reading stills; the playback rubric (opening, payoff visible, zoom keeps the target, lines finish, sounds match results); stating what remains unchecked. | `screening`, `reel`, `reshoot` |
| `troubleshooting.md` | Engine or image missing, app unreachable from the container, selectors that changed, hangs and network quiet warnings, slow or failing speech, cropped zooms, a failed compose (the old reel stays, `.reel.partial/` shows why). | all |

## Helpers (`plugin/scripts/`)

Node standard library only, argument arrays for subprocesses, paths with spaces work, plain text or `--json`. Exit
0 when every required check passes, 1 when one fails, 2 for bad input or a missing prerequisite. They install,
start, pull and build nothing.

**`preflight.mjs --url URL [--version V] [--script FILE] [--json]`**
- Node `>=22.18`; Docker or Podman, and its daemon answering.
- The runtime version: `--version`, else the `flow-reel` installed beside the script (`node_modules/flow-reel/
  package.json`); outside the range in `language.md` → 1, naming the range.
- `ghcr.io/codeonym-oss/flow-reel:<version>` present locally; if not, says the first compose pulls it (~7 GB) and
  gives `docker pull …`.
- The URL answers within 5 s (status reported; a redirect to a login is reported as such); the script exists.

**`stills.mjs REEL --to DIR [--json]`**
- Calls the installed `flow-reel verify REEL` first and stops on a non-zero exit (no installed `flow-reel` → 2, with
  the install command).
- Reads `transcript.json`; for each step, a frame at `startMs` and at `endMs - 1` (a frame inside the video);
  writes `DIR/step-NNN-start.png`, `…-end.png` and `DIR/contact-sheet.png` (a grid with step numbers and comments
  listed in `DIR/index.md`).
- Reports streams (video size, fps, audio present) and duration.
- ffmpeg: the host's if present, else the composer image's (`--entrypoint ffmpeg`, the reel mounted read-only,
  `DIR` mounted for writing); neither → 2 with what to install. Never pulls an image.
- Refuses a `DIR` inside the reel (it would break `verify`).

## Templates and sample (`plugin/assets/`, `plugin/examples/`)

- `assets/brief.md`: audience, takeaway, app URL and starting state, runtime version, the scene table (action,
  locator as observed, visible result, comment, sound, effect), observed facts kept apart from guesses.
- `assets/script.ts`: a commented starter in the 0.2 words with a result wait before `sound(Sounds.feedback.SUCCESS)`.
- `assets/handoff.md`: the reel folder, the compose command, the settings used, what screening checked and what
  it didn't, reset steps for the app.
- `examples/saved-views/`: one `index.html` app (no network, no fonts from outside), its `brief.md`, a `script.ts`
  using comments, sounds and a `zoomIn` … `zoomOut`, `flow-reel.json`, and a README with the serve command.

## Scenarios (the agent trial and review)

| Scenario | Expected |
|---|---|
| Fresh request on the sample | `reel` explores, writes a script with real locators, composes, runs `stills.mjs`, hands over. |
| "The zoom on the chart is rushed" | `reshoot` keeps the before reel, holds the camera with `zoomIn` … `zoomOut` on that scene only, compares, explains. |
| Save is slow | Waits for the visible saved state, then the sound; no sleeps added. |
| Docker missing / app down | `preflight.mjs` names it and the next command; nothing installed or started. |
| App needs a login | Says the exploration login doesn't reach the composer; uses a route that doesn't need it or stops. |
| "Add background music" | Says the composer has no music; offers what it can do. |
| Agent can't view images | Screening states the stills weren't looked at and asks a person to play the reel. |

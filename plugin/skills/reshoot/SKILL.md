---
name: reshoot
description: Change an existing flow-reel reel from feedback - "the zoom is rushed", "cut that line", "add a success sound", "the button was renamed" - by editing only the script's affected comments, sounds and effects, composing again and comparing with the reel before. Use when a reel and its script exist and someone wants something in it changed.
---

# Reshoot a reel

The script changes; the composer shoots it again. Nothing edits the video directly. `<skill-dir>` is this file's
folder; the shared files are two levels up.

## 1. Understand the feedback

Map each piece of feedback to the steps it concerns: read the script, the brief if there is one, `transcript.json`
(each step's comment and times) and `events.json`. If the feedback is vague ("make it better"), screen the reel first
with the `screening` skill (`<skill-dir>/../screening/SKILL.md`) and propose concrete changes.

If the feedback asks for something flow-reel doesn't have (music, another voice provider, a set duration, a new
effect), check `<skill-dir>/../../references/language.md` and say so; offer what it can do.

## 2. Keep the reel before

Copy `<name>.reel/` to `<name>.reel.before/` beside it (the whole folder), then
`npx flow-reel verify <name>.reel.before`. Keep it until the person accepts the new reel.

## 3. Change only what the feedback points at

Use the craft references for the kind of change:

| Feedback about | Read |
|---|---|
| The camera, zooms, pace, a card | `<skill-dir>/../../references/direction.md` |
| What the voice says, its length, the speaker | `<skill-dir>/../../references/comments.md` |
| Sounds | `<skill-dir>/../../references/sound-design.md` |
| A scene's order, what's on screen | `<skill-dir>/../../references/scenes.md` |
| A recipe to follow | `<skill-dir>/../../references/shots.md` |
| The app changed, a locator fails | `<skill-dir>/../../references/exploring.md`, `<skill-dir>/../../references/troubleshooting.md` |

Leave every other step as it was: unchanged comments then reuse their speech, and the comparison stays meaningful.
Reset the app's data first if the script creates data.

## 4. Compose and screen

`npx flow-reel compose <script>`, then screen it as `<skill-dir>/../../references/screening.md` says (verify,
`node <skill-dir>/../../scripts/stills.mjs <reel> --to <folder outside the reel>`).

## 5. Compare and report

`npx flow-reel compare <name>.reel.before <name>.reel`. Differences should be only where you changed the script;
explain each one. Report what changed, how it was checked, and whether playback is still pending. Delete
`<name>.reel.before/` only when the person is done with it.

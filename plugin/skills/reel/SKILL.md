---
name: reel
description: Make a narrated, polished video (a reel) of a web app's feature with flow-reel, from the request to the finished video - plan the story, explore the running app, write the script with comments, sounds and effects, compose it, screen it and hand it over. Use when someone asks for a demo, walkthrough, feature video or reel of their app, or to continue one that was started.
---

# Make a reel

flow-reel composes a **script** (Playwright plus the words `comment`, `sound`, `flash`, `zoomIn`, `zoomOut`,
`speedUp`, `skip`, the `card` words, `callout`, `highlight` and `lowerThird`) into a **reel**: a folder with the video, captions and transcript. This skill takes a request all the way.
`<skill-dir>` is this file's folder; the shared files are two levels up.

## Pick up where things are

Look in the project before starting: a `brief.md`, a script importing `flow-reel`, a `<name>.reel/` folder. Start at
the first step whose output is missing. If a reel exists and the person has feedback on it, use the `reshoot` skill
(`<skill-dir>/../reshoot/SKILL.md`) instead; to only judge a reel, use `screening`.

## 1. Plan

Read `<skill-dir>/../../references/story.md`. Settle the audience and the one takeaway, asking the person only what
you can't infer. Copy `<skill-dir>/../../assets/brief.md` beside where the script will go and fill in the scenes.

## 2. Explore the app

Read `<skill-dir>/../../references/exploring.md`. Open the running app with the browser tool you have, walk the
scenes, and fill the brief's scene table with real locators, states and results. Stop and say so if the app needs a
login the composer can't replay.

## 3. Check what composing needs

Run `node <skill-dir>/../../scripts/preflight.mjs --url <app url> --script <script path>`. Fix nothing silently:
report each failed check and its fix to the person, and do the fix only with their consent (installing flow-reel
with `npm install --save-dev flow-reel@0.5` in their project is the usual one; a missing cloud voice key is theirs
to set in their shell). The first compose pulls a large image.

## 4. Write the script

Read `<skill-dir>/../../references/language.md` (the only source for words, options and flags),
`<skill-dir>/../../references/scenes.md`, `<skill-dir>/../../references/comments.md`,
`<skill-dir>/../../references/direction.md` and `<skill-dir>/../../references/sound-design.md`; take recipes from
`<skill-dir>/../../references/shots.md`. Start from `<skill-dir>/../../assets/script.ts` or a recipe.

- One comment per scene; wait for every visible result before marking it with a sound or a flash.
- Let polish handle buttons and forms; direct the camera only where the story needs it.
- A wait longer than a few seconds goes inside `speedUp` (progress worth seeing) or `skip` (only the result
  matters), with a `timeout` that covers it.
- No word, option or flag that `language.md` doesn't list.

`<skill-dir>/../../examples/saved-views/` is a complete worked example (app, brief, script, settings).

## 5. Compose

`npx flow-reel compose <script>`. The local voice is slow on a CPU (about a minute a comment); say so before
starting, or offer a cloud voice (`<skill-dir>/../../references/comments.md`, "The voice"). If it
fails, read `<skill-dir>/../../references/troubleshooting.md` and find the cause before composing again; the old
reel stays as it was.

## 6. Screen

Follow `<skill-dir>/../../references/screening.md`: `npx flow-reel verify <reel>`, then
`node <skill-dir>/../../scripts/stills.mjs <reel> --to <a folder outside the reel>` and look at the contact sheet
and the stills against the brief. Fix what must be fixed (back to step 4, recomposing reuses unchanged comments)
before handing over.

## 7. Hand over

Fill `<skill-dir>/../../assets/handoff.md`: the reel, the script, the command to compose it again, what was checked
and what wasn't. If nobody has played the video, say playback is pending and ask the person to watch it.

# GH-6 agent trial (impl.md step 14)

**Date:** 2026-11-15. **Client:** Claude Code 2.1.325, headless (`claude -p`), default model, in a fresh folder.
**Plugin:** a copy of `plugin/` from `feat/6-plugin-suite`, loaded with `--plugin-dir`, settings from the project
only (`--setting-sources project`, so no other plugin or user instruction). **Tools:** file tools, `Skill`, and Bash
limited to `npx flow-reel`, `node`, `curl`, `ls`, `cat`, `mkdir`, `cp`. **Project:** `npm init` plus
`flow-reel@0.2.0` from npm, `app/index.html` (the example app), served on http://localhost:4174/.

**Request (verbatim):** "Our web app Orbit is running at http://localhost:4174/ (its source is in app/). Make a
short narrated video for our customers showing how to save a filtered view of the projects and find it again.
flow-reel is installed in this project. Put the script in demos/. When you're done, tell me where the video is and
how to make it again."

## What it did

1. Loaded `flow-reel:reel` on its own; read `story.md`, the brief template, `exploring.md`, `language.md`,
   `scenes.md`, `comments.md`, `direction.md`, `sound-design.md`, and the saved-views example.
2. Ran `preflight.mjs` (all ok but the not-yet-written script); explored the live app with Playwright from the
   installed package and a local Chromium, confirming every locator.
3. Wrote `demos/brief.md`, `demos/saved-views.ts` (3 scenes: comments, `controls.TOGGLE`, `navigation.OPEN`,
   `feedback.SUCCESS` after waiting for the status, `zoomIn` on the confirmation, `.zoomOut()` chained on the
   payoff) and `demos/flow-reel.json`.
4. Composed (3 comments voiced), ran `flow-reel verify` and `stills.mjs`, looked at the contact sheet and two stills,
   and found its own defect: the click zoom stayed on the closed dialog and cropped the "saved" message. Fixed the
   script, recomposed (0 voiced, 3 reused), re-checked the stills.
5. Wrote `demos/handoff.md` and answered with the reel's path, the compose command, what was checked, and
   "Playback: pending".

**Result:** a 17.1 s reel, `flow-reel verify` passes (8 files). The session reported two results (37 and 18 turns,
182 s and 165 s of agent time, waiting for the background compose in between); the CLI's last reported cost was
$1.16.

## Scenarios from `skill-suite.md` exercised

- Fresh request on the sample: passed (explored, real locators, composed, stills, handed over).
- Save is slow: passed (waited for the status, then the sound; no sleeps).
- Agent can't play video: it said playback is pending and asked for it.
- Not exercised: reshoot, missing Docker, app down, login, music request.

## What it taught us

- The example app's saved-view link did nothing; the agent refused to end on a click that would suggest it
  restores the filter. Fixed in the example: the link now restores its filter.
- Some of its Bash calls were refused by the trial's allowlist (`;`, `&&` with unlisted commands); it fell back to
  file tools. Not a plugin issue.

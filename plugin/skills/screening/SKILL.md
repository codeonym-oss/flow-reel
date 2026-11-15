---
name: screening
description: Judge a finished flow-reel reel without changing anything - verify its files, pull stills of every step to check framing and payoff, compare two reels, check sounds and comments against what is on screen, and write findings that say how each was checked. Use when someone asks to review, check or QA a reel or a demo video made with flow-reel, or before sharing one.
---

# Screen a reel

Read-only: this skill writes findings and stills (outside the reel), and changes no script and no reel. To act on
the findings, use the `reshoot` skill (`<skill-dir>/../reshoot/SKILL.md`). `<skill-dir>` is this file's folder.

Follow `<skill-dir>/../../references/screening.md`:

1. **Files:** `npx flow-reel verify <reel>`. A failure is the first finding; don't fix the manifest.
2. **Pictures:** `node <skill-dir>/../../scripts/stills.mjs <reel> --to <folder outside the reel>`. Look at
   `contact-sheet.png` and the stills it lists in `index.md`, with the script and its brief beside them. Judge
   framing and effects with `<skill-dir>/../../references/direction.md`.
3. **Comments and sounds:** read `transcript.json`, `captions.vtt` and `events.json`; judge them with
   `<skill-dir>/../../references/comments.md` and `<skill-dir>/../../references/sound-design.md`.
4. **Two reels** (before and after, or two composes of one script): `npx flow-reel compare <a.reel> <b.reel>`.
5. **Playback:** play `video.mp4` if you can; otherwise ask the person to, naming what to listen and look for.

Write the findings as the rubric says: by step, with how each was checked, grouped into must fix, should fix and
fine; then what wasn't checked. Words, options and flags in any suggested fix must exist in
`<skill-dir>/../../references/language.md`.

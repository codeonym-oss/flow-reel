# 008: Ten references teach the language and the craft, loaded when a step needs them

**Supersedes 003:** 0.2 gives the script effects (`flash`, `showFrame`, `zoomIn`, `zoomOut`), `autoZoom: false` and
voice settings, so the plugin teaches them instead of saying the camera can't be directed. Still standing from 003:
audience-first stories, short spoken lines, waiting for the real result before marking it, and never inventing a
flag or an option the composer doesn't have.

**Date:** 2026-11-15 (re-plan for 0.2, Q3; agreed: "ok")

**Question:** which references do `reel`, `reshoot` and `screening` share?

**Decision:** **ten focused files in `plugin/references/`:**

| File | Teaches |
|---|---|
| `language.md` | The exact 0.2 API: words and options, `Sounds`, flags, `flow-reel.json`, the reel's files; the runtime versions the plugin supports. |
| `story.md` | Audience, one takeaway, opening → change → payoff, turned into a list of scenes. |
| `scenes.md` | One scene: starting state, viewport, fixture data, what is on screen before the action, how long to hold. |
| `direction.md` | The camera: what polish does alone, when to take over with `zoomIn` … `zoomOut`, `flash` for emphasis, `showFrame` for title or diagram cards, `autoZoom: false`, pacing. |
| `comments.md` | Spoken lines: one idea each, speakable, starting with the action; choosing a speaker and a language. |
| `sound-design.md` | The eight sounds and what each means, automatic clicks and typing, placing a sound after its result, no stacking, pairing with effects, ducking under speech, `--no-sound`. |
| `shots.md` | Worked, typechecked recipes combining comments, sounds and effects: reveal, before and after, a saved form, an error and its recovery, a settings toggle. |
| `exploring.md` | Real locators and states in the running app; exploration logins don't reach the composer. |
| `screening.md` | What verify and compare prove and don't; the playback rubric. |
| `troubleshooting.md` | Failing composes, selectors, hangs, the voice, cropping, a stale reel. |

"Scene" (a few steps with one purpose) and "shot" (a recipe) are editorial words of the references, not
`CONTEXT.md` terms.

- **Why:** each step loads only what it needs; `shots.md` shows the three word families working together, which is
  what makes a reel look professional.
- **Not chosen:** four large files (every editorial job loads all the craft); no `shots.md` (no place where the
  families meet).

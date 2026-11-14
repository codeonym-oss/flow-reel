# Declare the flow-reel language in CONTEXT.md

## Problem

The project has no written vocabulary. The same thing is called a demo, a script or a scenario; the engine is a
runner or a recorder; the output is a take. Agents and contributors cannot tell which word is current.

## Change

Add `CONTEXT.md` at the repository root with the terms of story decision 009: each term, its one meaning, the words
it replaces, and how the terms relate (a script is composed into a cassette by the composer, through an integration
and a voice). Link it from `AGENTS.md` and the README. No code is renamed here.

## Out of scope

Renaming code or changing behaviour (ticket 2 onwards).

## Done when

- `CONTEXT.md` defines every term of decision 009 once, with the words to avoid.
- `AGENTS.md` tells agents to read it, and the README links to it.
- Nothing in `src/`, the image or the published package changes.

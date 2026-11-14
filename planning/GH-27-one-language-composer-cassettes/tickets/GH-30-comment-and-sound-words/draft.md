# Write scripts with comment and sound words, chained or standalone

## Problem

A script can only narrate a whole step (`step("…", action)`) and drop a sound at the current time (`sfx("…")`).
A spoken line or a sound cannot be attached to the element it is about, and the words are not the project's
vocabulary.

## Change

Replace `demo`, `step` and `sfx` with the 0.2 script language for the Playwright integration: **comment** and
**sound**, each usable standalone or chained on an element (for example a comment on the login button's click).
The CLI command becomes `flow-reel compose <script>` (story decisions 001, 008, 009). Timing, voicing, captions and
sound mixing keep today's behaviour.

## Out of scope

Effect words (ticket 5), the cassette manifest (ticket 4), other integrations.

## Done when

- A script using only the new words composes to a video with the same quality checks as today's fixture.
- Standalone and chained forms of comment and sound are both covered by tests, including what happens to timing
  when several are attached to one step.
- `demo`, `step`, `sfx` and `flow-reel record` are gone from the public API, the README and the tests.
- `CONTEXT.md` and the README show the language with runnable examples.

## For the ticket pass

The exact spelling of the words and what a step is when comments chain. Build a small prototype of two or three
real scripts first so the person can read them before choosing (grilling rule 7).

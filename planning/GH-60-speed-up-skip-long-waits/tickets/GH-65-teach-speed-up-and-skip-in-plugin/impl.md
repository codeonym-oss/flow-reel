# GH-65 implementation plan: teach speedUp and skip in the plugin

Ticket decisions 001–002; story decisions 003, 005, 006, 007; GH-62 decision 001. Planned against `main` at
f97bf62 (GH-62 merged, 0.4.0 not yet released).

## Read first

- `plugin/references/language.md` (the supported range, effects, polish), `direction.md`, `scenes.md`, `shots.md`,
  `screening.md`, `troubleshooting.md`, `plugin/skills/{reel,reshoot}/SKILL.md`, `plugin/assets/`.
- `plugin/scripts/preflight.mjs` (`satisfies`, the runtime and voice checks), `plugin/scripts/stills.mjs`.
- The README's "Speed up a wait" and "Skip a wait", and `CONTEXT.md` (Speed-up, Skip).
- `test/unit/plugin.test.ts` (range includes the package version; scripts typechecked) and `plugin-helpers.test.ts`.

## Steps

1. **Language.** A "Long waits" section with a script, a table of both words, and the rules (one action, pass a
   function, a timeout, pick by what the viewer should see, only actions inside, speech over the wait,
   `{duration}`, errors, events). The `showFrame` note and the reel's `events.json` row follow.
   → check: `plugin.test.ts` typechecks the new script.
2. **Craft references and templates.** Two `shots.md` recipes (an agent's reply under `speedUp`, a build under
   `skip`); waits in `direction.md` (pacing), `scenes.md`, `screening.md`, `troubleshooting.md`, the reel and
   reshoot skills, the brief template and the starter script. Remove the 0.1 troubleshooting row.
   → check: recipes typecheck; links resolve.
3. **Install lines.** `flow-reel@0.4` in the reel skill, preflight's fixes and stills. Range `>=0.2.0 <0.5.0`.
   → PR #69, merged before release PR #64.
4. **Tests on 0.4.** The preflight tests' happy paths on 0.4.x. → PR #71; passes under both ranges.
5. **Narrow.** After 0.4.0 is published: range `>=0.4.0 <0.5.0`, no per-version notes, no cloud-voice version
   branch in preflight. → PR #72; then merge the plugin release PR. → check: plugin tests with the package at 0.4.0.

## Corrections during the build

- The draft's order (plugin after 0.4.0) couldn't hold: the range test blocked #64. See decision 001.
- release-please released the first plugin PR with 0.4.0 (one release PR for both components), as plugin 0.3.0.

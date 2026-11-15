# GH-34 implementation plan

Planned 2026-11-15 against `main` at 6aa66c4. Unit tests: 180 pass.

What the code already has: the README's "From 0.1 to 0.2" table covers `demo`, `step`, `sfx`, `record` and the
loose files; `scripts/consumer.ts` uses the 0.2 words; release PR #38 (0.1.2 → 0.2.0) lists the three breaking
changes; merging it runs `publish.yml` (images by digest on both architectures, npm from `main` with provenance,
installed-package checks). Decisions: 001 (`--no-sound`), 002 (chained sound on uncovered actions).

## Read first

- `src/cli.ts`: `USAGE`, `parseCompose` (`--no-sfx`), `ComposeArgs.sfx`, the container branch passing `sfx`.
- `src/host/launch.ts`: `RunArgsInput.sfx`, `buildRunArgs` (`--no-sfx`), `LaunchOptions.sfx`.
- `src/composer/compose.ts`: `ComposeOptions.sfx` passed to `renderTimeline`.
- `src/composer/media/render.ts`: `sfx?` option; `src/composer/media/sound-mix.ts`: `work/sfx.wav`.
- `src/adapters/playwright/wrap.ts`: the `LOCATOR_UNCOVERED` branch of `wrapLocator`.
- `README.md`: lines on `--no-sfx` (Compose, Sounds) and `sfx.wav`; the "From 0.1 to 0.2" table.
- Tests: `test/unit/cli.test.ts`, `launch.test.ts`, `wrap.test.ts` (the `press` case near line 340);
  `test/e2e/record.test.ts` (`--no-sfx`, `work/sfx.wav`), `test/e2e/sfx.test.ts` (`sfx.wav`).

## Steps

1. **Flag** (decision 001): `--no-sfx` → `--no-sound` in `USAGE` and `parseCompose`; the option threaded from the
   CLI through `launch`, `buildRunArgs`, `compose` and `renderTimeline` is renamed `sfx` → `sound`. No alias: an
   old `--no-sfx` is rejected as an unknown option, like any other.
   → check: `cli.test.ts` and `launch.test.ts` updated to `--no-sound`, plus one case that `--no-sfx` is rejected;
   `npm run typecheck`; `npm test`.
2. **Work file** (decision 001): `work/sfx.wav` → `work/sound.wav` in `sound-mix.ts`.
   → check: `record.test.ts` and `sfx.test.ts` read `sound.wav`; covered by the local e2e run (step 6).
3. **Chained sound on uncovered actions** (decision 002): in the `LOCATOR_UNCOVERED` branch, a chained sound plays
   when the action happens (with the flash), and the fast path is taken only when nothing is chained.
   → check: a new `wrap.test.ts` case, `.sound(Sounds.feedback.SUCCESS).press("Enter")`, sees the sound staged once
   at the action; write it first and see it fail.
4. **README:** `--no-sound` in the Compose and Sounds sections, `sound.wav` in the work-folder paragraph, and a
   row in "From 0.1 to 0.2": `--no-sfx` → `--no-sound`.
   → check: `grep -n "no-sfx\|sfx\.wav" README.md` finds only the migration row.
5. **Planning:** GH-33 done (already staged on `main`), GH-34 status in `meta.md` as it moves; story GH-27's `meta.md`
   done once #38 is merged and published (in a later planning commit, or the next PR).
   → check: `git diff --stat` shows only these planning files besides steps 1–4.
6. **Local verification:** `npm run typecheck`, `npm test`, then `npm run test:e2e` (record and sfx suites at least).
   → check: all pass; the record e2e's muted run has no `work/sound.wav`.
7. **PR** (after a yes): branch `feat/34-release-0-2`, title `feat!: name the mute flag --no-sound and play chained
   sounds on every action (#34)`, body `Part of #34` (the release PR closes it), a `BREAKING CHANGE:` footer
   naming `--no-sound`; no line starts with `word(`. Board: #34 In Progress at the branch, In Review at the PR,
   squash-merge after CI.
   → check: CI green on both architectures; #38's body then lists the new breaking change.
8. **Release** (after a separate yes): merge #38. release-please tags `v0.2.0` and calls `publish.yml`.
   → check: the publish run is green, including `installed` on amd64 and arm64.
9. **Verify the release (read-only):** `npm view flow-reel@0.2.0` (with provenance) and `npm view flow-reel@0.1.2`;
   `docker manifest inspect ghcr.io/codeonym-oss/flow-reel:0.2.0` and `:0.1.2`, each listing amd64 and arm64.
   → check: all four exist; then close #34, move it to Done, set GH-34 and GH-27 `done`.

## Tests

- Unit, at the CLI and launch seams: the flag's new name, the old one rejected, the run arguments.
- Unit, at the wrapper: a chained sound on `press` is staged at the action.
- E2E (local and in CI): the muted compose and the sound bus file name.
- Release: the existing `publish.yml` jobs; no new release tests.

## Risks

- **A missed `--no-sfx`** in docs or tests: step 4's grep, and the e2e muted run.
- **Playing a chained sound on uncovered actions changes `events.json` for scripts that chain one there:** intended
  (they were silent by mistake); the fixtures that compare reels don't chain sounds on uncovered actions.
- **`docker/sfx/` and `assembleSfx` keep the old word:** an asset folder inside the image and an internal function;
  not user-facing, left as they are (no unrelated clean-up). Noted here, not changed.
- **The release takes the same path as 0.1.1 and 0.1.2,** so the risk is the workflow itself failing (runner
  disk, registry); recovery is a `publish.yml` dispatch with `source_run` (docs/releasing.md).

## Corrections during the build

- Step 1: the rejected `--no-sfx` case replaces `--wat` in `cli.test.ts` instead of being added. That test spawns one
  CLI process per argument list and was already near its 10 s timeout; one more list made it time out under the
  parallel unit run. Both cases test an unknown option, so the coverage is the same.
- Step 4: the README also used "effects" to mean sounds (the audio-stream sentence, the work-folder paragraph and
  the Sounds section); those now say sounds, since an effect is a change to the picture (CONTEXT.md).

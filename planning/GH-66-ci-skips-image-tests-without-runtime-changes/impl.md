# GH-66 implementation plan: CI skips the image build and e2e tests when no runtime file changed

Planned against `main` at 7988cee. No open questions: the draft settles the paths; one choice is made below.

## Read first

- `.github/workflows/ci.yml`: `minimum-node` and the `test` matrix (typecheck, unit tests, pack check, then the
  image build, `test:e2e`, the consumer check and the artifact upload).
- `.github/workflows/publish.yml` and `release-please.yml`: untouched; publishing runs its own e2e from the tag.

## The choice made here

**Skip steps, not the job.** The `test (amd64)` and `test (arm64)` jobs still run on every pull request and report
under the same names; only their image and e2e steps carry an `if`. Typecheck, unit tests and `pack:check` keep
running on both architectures (a few minutes), and nothing that reads check names sees a job go missing.

## Steps

1. **A `changes` job.** On `pull_request` only: checkout with `fetch-depth: 0`, then
   `git diff --name-only "origin/$BASE_REF...HEAD"`, and output `runtime=true` when any changed path is not one of:
   `plugin/**` other than `plugin/examples/**`, `planning/**`, `*.md` anywhere. On `push` and `workflow_dispatch` it
   outputs `runtime=true` without diffing. Written as a short `bash` step with `grep -Ev`, no third-party action.
   → check: run the same script locally against three ranges: a plugin-only change (false), a `src/` change (true),
   a `plugin/examples/` change (true); an empty diff (false).
2. **Gate the heavy steps.** `test` `needs: changes`; the steps from "Reserve space" through the artifact upload get
   `if: needs.changes.outputs.runtime == 'true'` (the upload keeps `always()` inside that condition). `minimum-node`
   is unchanged.
   → check: `actionlint` if available, else a YAML parse; the PR for this ticket itself touches `.github/`, so it runs
   the full matrix (a runtime path), which proves the gate opens.
3. **Prove the fast path.** After merging, the next plugin-only PR (GH-65) shows the image and e2e steps skipped and
   CI done in a few minutes. Noted in GH-65's plan as a check.

## Tests

- The path rule, run locally on real commit ranges (step 1).
- This PR's own CI (full run), and GH-65's CI (fast run).

## Risks

- **A runtime file classed as not runtime** would skip the e2e it needed. Only `plugin/**` (without examples),
  `planning/**` and Markdown are excluded; Markdown can't change behaviour, and the plugin's code is covered by the
  unit tests that still run.
- **Base ref missing** in the diff (shallow clone): `fetch-depth: 0` avoids it; if the diff command fails, the step
  fails rather than skipping silently (`set -euo pipefail`).

## Corrections after the build

- Pushes to `main` still ran everything, so every planning-only or plugin-only merge cost about 20 minutes on both
  architectures. The person asked for pushes to use the same rule: PR #73 diffs `github.event.before..HEAD`, and
  falls back to running everything for a manual run or a push whose previous commit can't be diffed.
- The fast path was confirmed on PRs #69 and #70: the test jobs took about a minute.

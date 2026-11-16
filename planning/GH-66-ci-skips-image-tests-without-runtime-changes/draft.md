# CI skips the image build and e2e tests when no runtime file changed

## Problem

Every pull request builds the 7 GB image for amd64 and arm64 and runs the whole e2e suite, about 30 minutes, even
when it changes only the plugin, planning files or Markdown, which those tests can't be affected by.

## Change

- A first `changes` job diffs the pull request against its base (plain `git diff`, no third-party action) and says
  whether a runtime file changed.
- The image build and the e2e matrix run only when one did; the unit tests (including the plugin's consistency
  checks) and the minimum-Node job run on every pull request.
- Not runtime: `plugin/**` except `plugin/examples/**` (the e2e tests compose the worked example), `planning/**`, and
  Markdown files.
- Pushes to `main` always run everything: publishing relies on `main` being green.
- `main` has no branch protection, so a skipped job can't block a merge.

## Done when

- A plugin-only pull request finishes CI in a few minutes, with the e2e jobs skipped.
- A pull request touching `src/` (or `plugin/examples/`) still runs the full matrix; a push to `main` always does.

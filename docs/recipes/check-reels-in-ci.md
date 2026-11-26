# Check reels in CI

`flow-reel verify` and `flow-reel compare` read reels on the host, without Docker or FFmpeg, so they're cheap to run
in any CI job. Commit the reels you publish, and let CI catch a reel that
was edited by hand or no longer matches its script.

## Verify every committed reel

```yaml
# .github/workflows/reels.yml
name: Reels
on:
  pull_request:
    paths: ["reels/**"]

jobs:
  verify:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: npm ci
      - name: Every reel is whole and unaltered
        run: |
          for reel in reels/out/*.reel; do
            npx flow-reel verify "$reel"
          done
```

`verify` exits 1 when a file is missing, extra or changed, naming each one, and 2 when a folder isn't a reel.

## Check a recompose still matches

When someone composes a reel again, for example after a UI change, `compare` says whether the story is still the
same: the same steps, comments, voice and effects, with each step starting within ±150 ms.

```sh
git worktree add /tmp/main main            # the reels as they are on main
npx flow-reel compare /tmp/main/reels/out/onboarding.reel reels/out/onboarding.reel
git worktree remove /tmp/main
```

Exit 0 means the reels match, and 1 means they differ, with the step or file named. A difference isn't always a
mistake: a changed comment is meant to differ. Read the output before merging.

## Composing in CI

Composing needs Docker, about 2.5 free CPU cores, the composer image (about 2.6 GB
with a cloud voice) and your app running. It's possible on
a CI runner, but heavier than checking:

- Use a [cloud voice](../guide/voices.md) and store its key as a CI secret, exposed to the job as the environment
  variable that `apiKeyEnv` names. The local voice needs more than 5 GiB of memory and minutes per comment.
- Start your app in the job before composing, on the `url` the script uses.
- In CI nothing asks a question: progress is plain lines, or JSON with `--json`, and the exit code says how the run
  ended ([exit codes](../reference/cli.md#exit-codes)).
- On an overloaded runner, the compose stops with an error rather than save a video whose timing is off.

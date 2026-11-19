# CI runs only the checks a change needs, and the e2e in parallel shards

Takes up the follow-up `planning/follow-ups/2026-11-16_1745_ci-runs-checks-a-change-does-not-need.md`.

## Why

An image run took about 20 minutes per architecture (main, 2026-11-18, run 44385908909): 2 minutes of image build,
16 of e2e. `record.test.ts` alone took 10½ minutes, and the local voice spoke about 226 s of it, most of it for composes
that test speedUp, skip and cards rather than the voice. The path rule listed what *isn't* runtime, so a plugin release
PR (the release manifest) ran the image tests, and docs-only PRs ran the unit tests three times.

## What it does

- `changes` lists what each check reads: **code** (typecheck, unit tests, pack check) and **runtime** (image, e2e).
  Docs, planning and Markdown elsewhere run neither; the release manifest alone is code, not runtime.
- One **unit** job per Node version (22.18.0, the floor package.json promises, and 26).
- The **e2e** job is skipped at the job level when nothing is runtime, and otherwise runs in four shards per
  architecture, listed in `test/e2e/shards.json`. `changes` fails if an e2e file is in no shard, or in two.
- `record.test.ts` is split into `record.test.ts` (the local voice), `record-effects`, `record-waits` and
  `record-cards`, sharing the fixture app in `test/e2e/fixture-app.ts`.
- The waits and cards composes use a fake OpenAI voice served by the fixture app. The local voice keeps its own
  tests: `tts.test.ts` and the `flow-reel compose` block.
- The e2e jobs install no ffmpeg: the tests' ffmpeg and ffprobe run in the image they just built. The unit jobs
  run on arm64 runners, whose mirror installs ffmpeg in seconds (amd64's took 7 to 27 minutes), up to three tries.

## Not part of it

- `publish.yml` keeps running the whole e2e from the tag.
- Moving the unit tests' ffmpeg into the image (the 2026-11-16 follow-up keeps that part).
- A paid cloud voice in CI: the fake voice is free, needs no secret, works on forks and stays deterministic.

# GH-92 implementation plan

Planned against `main` at 48faf42.

## Steps

1. **Split `record.test.ts`** by describe block into four files, with the fixture server moved to
   `test/e2e/fixture-app.ts` (`startFixtureApp`, `SLOW_MS`, `tone`, `fakeVoice`). The moved blocks are unchanged
   but for the voice. → check: `npm run typecheck`; every test name is still in exactly one file.
2. **The fake voice** answers `POST /v1/audio/speech` with 1.2 s of tone. The waits and cards composes write
   `voice: { adapter: "openai", baseUrl: http://localhost:<port>/v1 }` and pass `OPENAI_API_KEY` to `docker run`.
   `cloud-voice.test.ts` reuses `tone`. → check: their assertions only need the step to last as long as its clip.
3. **`test/e2e/shards.json`** lists four shards; `changes` checks it covers `test/e2e/*.test.ts` exactly and
   outputs the matrix. → check: run the step's script locally.
4. **`ci.yml`**: `changes` (code, runtime, shards), `unit` (node 22.18.0 and 26) and `e2e` (arch × shard). One shard
   per arch writes the image cache; the `voices` shard also runs the consumer check. → check: the path rules on
   sample changes (docs, README, planning, plugin release, plugin example, src, workflows, docker); this PR changes
   `ci.yml`, so it runs every shard, and its timings are the measure.

## Risks

- Shards are balanced by estimate; the first run's timings may move a file.
- Each shard builds the image from the cache: if the cache is cold, all of them build it.

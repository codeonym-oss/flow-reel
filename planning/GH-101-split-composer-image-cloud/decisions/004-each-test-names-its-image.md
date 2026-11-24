# 004: Each test names its image, and each shard builds only what it needs

**Date:** 2026-11-24 (grilling, Q4; agreed to the recommendation: "ok")

**Supersedes 003,** whose premise was wrong: most e2e tests don't compose through the CLI. `record-cards`,
`record-effects`, `record-waits` and most of `record.test.ts` call `docker run` with the full tag, so under 003 only
`cloud-voice.test.ts` would have tested the cloud image. Its "about a minute per shard" was not measured.

**Question:** how do CI and the release test the two images?

**Decision:** **a test says which image it needs, and a shard builds only those.** `waits` and `cards` use the cloud
image, `local-voice` the full one, `voices` both. A test whose image wasn't built fails with a clear message. The
release does the same per architecture, publishes both tags only after both pass, and checks the published cloud
tag with a consumer compose as well as the full one.

- **Why:** the cloud image gets real coverage, and the shards that don't need the local voice don't load it.
- **Not chosen:** every shard builds both (`waits` and `cards` load 4.3 GB they don't use); every non-voice test on
  both images (roughly doubles those tests).
- **Cost accepted:** cards and waits no longer run on the full image, which differs only by the voice layers.

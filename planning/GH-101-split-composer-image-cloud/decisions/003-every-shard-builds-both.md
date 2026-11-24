# 003: Every e2e shard builds both images, and the CLI routes each compose

**Superseded by 004.**

**Date:** 2026-11-23 (grilling, Q3; agreed: "ok")

**Question:** how do CI and the release test the two images?

**Decision:** **each e2e shard, in CI and in the release, builds both targets for its architecture; each compose then
runs in the image the CLI picks from its voice (decision 001).** Composes with the local voice (`tts.test.ts`,
`plugin.test.ts`, part of `record.test.ts`) run in the full image; those with the fake OpenAI voice (GH-92) run in
the cloud image. The release tags both images only after the e2e passes on both architectures.

- **Why:** the tests use exactly what users get, with no list to keep right; the cloud target adds only the npm and
  `dist` layers to the cached base, about a minute per shard.
- **Not chosen:** a per-shard list of the images it needs (a wrong list fails with a confusing pull error); only the
  full image in CI (a broken cloud image found at release time).

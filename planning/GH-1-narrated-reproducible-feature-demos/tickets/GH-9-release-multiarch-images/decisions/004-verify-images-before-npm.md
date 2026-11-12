# 004: Verify the exact candidate images on both architectures before publishing npm

**Date:** 2026-11-12 (ticket pass, Q4; agreed: "ok")

**Question:** verify candidate images before publishing npm, or publish everything before recording checks?

**Decision:** **push candidate image digests, pull and test those exact digests on native amd64 and arm64 runners, create the matching versioned multi-architecture image tag, then publish npm last.** Both architectures must pass before the release image tag and npm publication proceed.

- **Why:** users installing a newly published package need its matching images to be available and verified. Pulling candidate digests proves the registry artifacts work rather than merely testing a local build.
- **Not chosen:** publishing npm and final image tags before recording checks.
- **Boundary:** registries do not provide a transaction across GHCR and npm. Candidate digests can remain after a failed check; an npm failure can leave an already verified image available. Implementation must document safe retries and must not replace an existing release image with a different digest during recovery.

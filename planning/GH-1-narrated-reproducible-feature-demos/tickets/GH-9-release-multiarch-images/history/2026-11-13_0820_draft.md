# Publish multi-arch images to GHCR and the package to npm on release

## Problem

The host CLI already requests `ghcr.io/codeonym-oss/flow-reel:<package-version>`, but no release pipeline publishes that image or npm package. Users fall back to a large local build; native arm64 recording has not been established by the existing amd64 CI. The end-to-end fixtures currently build locally, so they cannot prove registry artifacts work.

## Change

- Use release-please version/changelog PRs on `main`, following the organization's projects (decision 001). Start public releases at **0.1.0** (decision 005); keep the npm version, release tag and image version aligned.
- Build Linux amd64 and arm64 images on native GitHub-hosted runners (decision 002), retaining bundled offline Qwen and the selected SFX.
- Push candidate images by digest, pull and verify the exact artifacts on both native architectures, then assemble the versioned multi-architecture image. Publish npm last (decision 004).
- Use npm trusted publishing after one-time setup, with publishing disabled until setup is ready (decision 003). Document package bootstrap, GHCR public visibility, release-PR CI credentials and failed-release recovery.
- Verify a clean consumer can install the released package and record through the matching public image without a local build. Keep the existing local-build fallback for development and pull failures.

## Out of scope

Agent plugins (GH-6), cloud speech, new recording features, GPU images, additional operating-system image variants, nightly/edge publishing, and broad dependency upgrades. No unrelated follow-ups are taken up.

## Done when

- Release-please prepares a reviewable initial 0.1.0 release, and subsequent version updates keep package metadata/lockfile, changelog and tag aligned.
- PR validation builds/tests both architectures without registry writes or publishing credentials. Existing type checking and unit/media checks remain green.
- Each release's exact pulled candidate image passes the narrated recording pair, sync/caption/event checks, same-architecture reproducibility comparison and offline synthesis checks on its native architecture. Capture overload limits remain enforced.
- The final image manifest contains native `linux/amd64` and `linux/arm64` images whose digests match the verified candidates; anonymous pulls work on both.
- npm publication uses OIDC after setup and occurs only after both image checks succeed. The published tarball matches the tested package artifact and includes the runtime Docker/TTS/SFX files without planning assets or model weights.
- `npx flow-reel@0.1.0 record demo.ts` is exercised from a clean consumer on both architectures using the matching published image, without local building, and produces a narrated MP4, captions and valid transcript/events.
- Setup instructions cover first publication and trusted-publisher configuration. Recovery can resume the same version from recorded immutable artifacts, refuses conflicting existing publications and never silently overwrites a release image.
- The first public release and its consumer checks are verified; unavailable account setup is reported explicitly rather than treated as completed publishing.

## Plan and decisions

See `impl.md` and decisions 001–005. Baseline on 2026-11-12: 80 unit tests and type checking pass; two sandbox-only subprocess failures disappear outside the sandbox. Existing full media baseline passed during GH-8; GH-9 must run its own checks against its changed release path.

## Current status — 2026-11-13

Implementation [PR #16](https://github.com/codeonym-oss/flow-reel/pull/16), initial release [PR #17](https://github.com/codeonym-oss/flow-reel/pull/17), and consumer correction [PR #18](https://github.com/codeonym-oss/flow-reel/pull/18) are merged. [flow-reel@0.1.0](https://www.npmjs.com/package/flow-reel/v/0.1.0) and the public image `ghcr.io/codeonym-oss/flow-reel:0.1.0` are available for Linux amd64/arm64.

[Recovery 43341164281](https://github.com/codeonym-oss/flow-reel/actions/runs/43341164281) passed all nine jobs, including 31 media tests per native candidate, immutable image verification, anonymous packed consumers, npm integrity and narrated registry-installed consumers on both architectures. [Correction CI 43341136606](https://github.com/codeonym-oss/flow-reel/actions/runs/43341136606) passed both architectures. The exact verified tarball was published; no tag, image or package was replaced.

The initial npm publication used authenticated bootstrap. Both trusted publisher identities are configured and `PUBLISH_TO_NPM=true` is enabled. Successful OIDC publication/provenance must be verified on the next new version; bootstrap is not evidence of it. See `docs/releasing.md`.

GH-9 is complete. GH-1 remains open for GH-6.

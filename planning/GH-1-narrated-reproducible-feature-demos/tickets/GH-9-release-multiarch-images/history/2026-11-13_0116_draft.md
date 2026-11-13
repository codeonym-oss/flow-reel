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

## Current status — 2026-11-12

Implementation [PR #16](https://github.com/codeonym-oss/flow-reel/pull/16) and initial release [PR #17](https://github.com/codeonym-oss/flow-reel/pull/17) are merged. [v0.1.0](https://github.com/codeonym-oss/flow-reel/releases/tag/v0.1.0) publishes the public image `ghcr.io/codeonym-oss/flow-reel:0.1.0` for Linux amd64/arm64. Both exact registry candidates passed all 31 media tests, and anonymous pulls plus packed-consumer recordings passed on both architectures. Native PR CI passed 86 unit tests and all media/package checks on each architecture.

**npm publication remains disabled:** owner signup is temporarily restricted by npm. GH-9 remains open/in progress until account/ownership setup, trusted publishers and npm publication/registry consumers are verified. The [release run](https://github.com/codeonym-oss/flow-reel/actions/runs/43306468361) deliberately fails only at its awaiting-npm-setup gate; image publication and both consumer jobs succeeded.

When account setup is available, use `docs/releasing.md` and recover tag `v0.1.0` from source run `43306468361`; preserve the verified artifact integrity and image digests.

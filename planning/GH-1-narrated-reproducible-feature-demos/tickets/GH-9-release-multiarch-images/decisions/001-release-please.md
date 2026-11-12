# 001: Prepare releases with release-please, following the organization's existing projects

**Date:** 2026-11-12 (ticket pass, Q1; agreed: "ok, check other projects how they do release please!")

**Question:** should releases start from release-please version/changelog PRs or manually maintained tags and releases?

**Decision:** **use release-please**, informed by the organization's existing release workflows. It prepares a version/changelog PR; merging the release PR creates the version tag and GitHub release. Flow-reel must publish the npm package and matching container image from that release.

- **Why:** follows the organization's convention and keeps version changes reviewable. The package version and image tag must agree (GH-2 decision 004).
- **Not chosen:** manually maintaining versions, changelogs and release tags.
- **Evidence:** inspected [groundwork's workflow](https://github.com/codeonym-oss/groundwork/blob/main/.github/workflows/release-please.yml), [design-skills' release workflow](https://github.com/codeonym-oss/design-skills/blob/main/.github/workflows/release-please.yml) and [image workflow](https://github.com/codeonym-oss/design-skills/blob/main/.github/workflows/image.yml), and [i18n-ai's release workflow](https://github.com/codeonym-oss/i18n-ai/blob/main/.github/workflows/release.yml) and the equivalent acli-py workflow on 2026-11-12. They use config/manifest files, main pushes plus manual dispatch, and an optional RELEASE_PLEASE_TOKEN falling back to GITHUB_TOKEN. Publishing runs downstream of release-please rather than depending on a token-created tag firing another workflow. Design-skills uses native architecture runners and joins image digests. Package projects use trusted publishing behind an enable switch. These are reference patterns; remaining flow-reel choices are settled separately.

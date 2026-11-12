# 002: Build and verify each image on its native architecture

**Date:** 2026-11-12 (ticket pass, Q2; agreed: "ok")

**Question:** build and test amd64 and arm64 on native GitHub runners, following design-skills, or emulate arm64?

**Decision:** **use native Linux amd64 and arm64 GitHub-hosted runners.** Both architectures must build and verify the bundled browser and local Qwen speech pipeline before their images are combined into the versioned multi-architecture image.

- **Why:** follows design-skills and verifies actual native recording behavior without emulation overhead. Public repositories have standard native arm64 runners.
- **Not chosen:** emulated arm64 builds/tests, which are slower and do not establish native recording performance.
- **References:** [design-skills image workflow](https://github.com/codeonym-oss/design-skills/blob/main/.github/workflows/image.yml); [GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

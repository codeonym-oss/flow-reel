# 004: The image builds on Playwright's noble image; its tag is the npm version; publishing comes in its own ticket

**Date:** 2026-11-02 (ticket pass, Q6; agreed: "ok")

**Question:** how is the image built, versioned and shipped in this ticket?

**Decision:** **`FROM mcr.microsoft.com/playwright:v<X>-noble`, plus Xvfb and ffmpeg.** The image tag equals the npm
package version (`ghcr.io/codeonym-oss/flow-reel:<version>`) and the CLI uses exactly that tag; when it can't be
pulled, the CLI builds it locally from the Dockerfile shipped in the package. The engine is detected: Docker, then
Podman. CI builds amd64. Multi-arch (arm64) builds and GHCR publishing on release are a separate ticket in this story.

- **Why:** pinning the image to the package version keeps "same script, same video" true across machines; the
  release pipeline is its own concern to review.
- **Not chosen:** the release pipeline inside this ticket (the biggest ticket grows further); a slim Debian base
  (maintaining browser dependencies to save ~500 MB that the TTS model outweighs anyway).
- **Cost accepted:** until the release ticket ships, the first run builds locally once; Apple Silicon runs emulated.

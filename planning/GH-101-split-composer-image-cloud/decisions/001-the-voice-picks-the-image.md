# 001: The voice picks the image

**Date:** 2026-11-23 (grilling, Q1; agreed: "ok")

**Question:** how is the image chosen for a compose?

**Decision:** **automatically, from the voice.** A cloud voice composes in `ghcr.io/codeonym-oss/flow-reel:<version>-cloud`;
the local voice (`qwen3-tts-0.6b`) composes in the full `ghcr.io/codeonym-oss/flow-reel:<version>`. There is no flag
or setting to choose the image.

- **Why:** the voice already decides which image can run the reel; a choice left to the user only adds a way to get
  it wrong (a Qwen reel on the cloud image fails).
- **Not chosen:** automatic plus a `--image` override (a flag, a setting and tests for a case nobody asked for); the
  user picks (everyone learns about images, and a wrong pick fails).
- **Builds on:** GH-2 decision 004 (the tag is the npm version); the `-cloud` tag carries the same version.

# 005: One release ships the runtime and the plugin

**Date:** 2026-11-24 (while building; agreed: "yes to both")

**Question:** does the plugin change wait for the runtime release?

**Decision:** **no. The plugin merges after the runtime pull request, and one release pull request ships both.**

- **Why:** plugin 0.7.0 accepts every runtime from 0.5.0, so with a runtime that has a cloud image it names the 7 GB
  image for a cloud voice, and its stills helper fails without ffmpeg when only the cloud image is there.
- **How:** stills tries both tags. Preflight names the `-cloud` tag from runtime 0.7.0 on, and the full tag before;
  the release pull request must give the runtime 0.7.0.
- **Not chosen:** releasing the plugin after the runtime, as first planned.
- **Cost accepted:** anyone still on plugin 0.7.0 keeps the old advice until they update it.

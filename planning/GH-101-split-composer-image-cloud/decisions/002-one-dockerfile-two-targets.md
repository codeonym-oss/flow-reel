# 002: One Dockerfile, a shared base stage, two targets

**Date:** 2026-11-23 (grilling, Q2; agreed: "ok")

**Question:** how are the full and the cloud image built?

**Decision:** **one `docker/Dockerfile` with a `base` stage and two targets.**

- `base`: Playwright's pinned image, Xvfb, ffmpeg and the fonts and sounds every compose uses.
- `cloud`: `base`, then the npm packages and `dist`.
- `full`: `base`, then the local voice's apt packages (`python3-venv`, `sox`, `libsndfile1`, `time`, used only by the
  local voice), its Python environment and model, then the npm packages and `dist`, in today's order.

- **Why:** both tags share the base layers (about 2.5 GB); a code change still reuses the cached voice layers (about
  4.3 GB), so CI and release builds stay as fast as now.
- **Not chosen:** `full` on top of `cloud` (every code change would rerun the pip install and the model download, to
  share about 160 MB more); two Dockerfiles (the shared part kept identical by hand drifts).
- **Cost accepted:** switching a machine from the cloud image to the full one downloads the app layers (about 160 MB)
  again besides the voice.

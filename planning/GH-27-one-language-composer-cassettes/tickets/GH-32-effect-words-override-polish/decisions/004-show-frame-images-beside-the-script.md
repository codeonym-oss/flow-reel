# 004: `showFrame` images are files in the script's folder; the event log records each one's hash

**Date:** 2026-11-14 (ticket pass, Q4; agreed: "ok")

**Question:** where do `showFrame` images come from, and what does the reel record about them?

**Decision:** **a path relative to the script, inside the script's folder; PNG, JPEG or WebP.** The `frame` event
records the path and the image's SHA-256. The image is not copied into the reel. An absolute path, a path that leaves
the script's folder, a missing file or another file type throws at the call with a clear message.

- **Why:** the container mounts only the script's folder, so nothing outside it can be read; the hash ties the reel
  to the exact image, which the manifest's script hash does not cover; the image already lives in the video.
- **Not chosen:** copying each image into the reel's `frames/` (every image stored twice, for little use); URLs
  (a download during compose breaks determinism).

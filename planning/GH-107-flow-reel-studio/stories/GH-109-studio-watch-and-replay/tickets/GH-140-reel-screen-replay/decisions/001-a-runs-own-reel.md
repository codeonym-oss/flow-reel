# 001: The Reel screen plays a run's own reel

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** which files does the Reel screen play: the reel in the output folder, or the run's copy?

**Decision:** **the run's own copy, `runs/<n>/reel/`, at `/reel/<run>`.** `GET /api/reel?run=` answers its
transcript, events, manifest files and size; `GET /api/reel-file?run=&path=` serves one of the manifest's files, with
byte ranges so the video can be scrubbed. Without a run in the path, the screen lists the runs that made a reel and
still have it. A run whose files were cleaned says so and names the published reel's folder.

- **Why:** the output folder holds only the latest reel of a script, and a later compose replaces it; the run's copy is
  exactly what that run made. Only the manifest's files are served, so nothing else of the run folder is reachable.

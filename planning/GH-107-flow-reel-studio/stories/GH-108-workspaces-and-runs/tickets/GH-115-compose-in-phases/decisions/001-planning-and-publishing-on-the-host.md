# 001: Planning and publishing run on the host; a container gets only what its phase reads

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **record, voice and render each get a container that mounts only the results they read, read-only.** Only the
recording and a cloud voice get the network, and only the voice gets a key. Planning is pure and publishing moves files, so
both run in the run's own process. The capture's frame count is written in the cue sheet, so planning needs no ffmpeg.

- **Why:** less to trust in each step (a script never sees a key, epic 022, already holds here), and fewer container starts.
- **Accepted cost:** render's intermediate files are removed when it ends; a failed render keeps them in `render.tmp/`.

# 014: A run copies the scripts folder as it starts, and containers see only the copy

**Date:** 2026-11-25 (chosen alone, 013)

**Question:** decision 005 fixes a run to one version of the project, and leaves open when a queued run reads it. A custom
card's page can load any file of the scripts folder at render time, so there is no list of files to copy after recording.

**Decision:** **`compose` copies the scripts folder into the run's folder, with the settings; the recording and the render
mount that copy read-only, and no container ever mounts the project.** Left out: the output folder, other reels,
`node_modules`, and names that start with a dot. The clips of the reel being replaced are copied too, for the reel cache.

- **Refines 002** (the folder is read-only, as a copy) and settles what 005 left open: the version is the one at `compose`.
- **Why:** one version from start to end, whatever is edited meanwhile; resuming needs nothing from the project; a script
  can't reach the project at all.
- **Accepted cost:** the copy takes space (a copy-on-write copy where the disk can); a script can't import npm packages from
  a `node_modules` in the scripts folder, which was never documented.
- **Not chosen:** mounting the project and copying listed files after recording (custom cards have no list); hashing files
  and failing when they changed (an edit while a run is queued would fail it).

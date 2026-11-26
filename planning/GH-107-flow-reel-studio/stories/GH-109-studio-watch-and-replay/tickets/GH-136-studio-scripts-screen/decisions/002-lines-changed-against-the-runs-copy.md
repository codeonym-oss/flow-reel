# 002: "Changed since the last reel" compares with the copy its run kept

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does the read-only source show the lines changed since the last reel?

**Decision:**

- The reel's `manifest.json` has the script's SHA-256. The same hash: nothing changed.
- Another hash: the lines are compared with the script as the run that made the reel copied it (`<run>/scripts/`),
  and the changed lines are marked. When that copy was cleaned, the screen only says the script changed since.
- The source is shown read only, with line numbers; the studio never writes a script.

- **Why:** the run's copy is exactly what the reel was made from; nothing else is.

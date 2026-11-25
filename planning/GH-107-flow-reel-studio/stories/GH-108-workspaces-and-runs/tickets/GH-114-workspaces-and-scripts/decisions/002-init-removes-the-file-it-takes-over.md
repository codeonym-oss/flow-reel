# 002: `init` removes the 0.7 file it takes over, and only lists the scripts to rename

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **`init` carries every setting of the one 0.7 `flow-reel.json` into the new file, then removes the old one,**
because a second one in the workspace is refused. It prints the `git mv` of each 0.7 script and renames nothing: a script's
name can be used by the project's own commands. Several 0.7 files are refused and listed.

- **Not chosen:** leaving the old file (the next compose would refuse it); renaming scripts (it would break what calls them).

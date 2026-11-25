# 007: Run data lives in flow-reel's own data folder, never in the project

**Date:** 2026-11-25 (stated by the person: "its like an appdata entry for flow reel", "the .partial progress shouldnt keep
appearing in the project dir , instead, its a job internal!")

**Decision:** **the tracker (SQLite) and the job folders live in flow-reel's data folder on the person's computer, and
work in progress stays there.** A project holds its `*.reel.ts` scripts, for example in `reels/`, and an output folder of
finished `x.reel/` folders, whose path is configurable (`reels/out`, or `demos/` at the root).

- **Changes:** GH-31 decision 005 (`<name>.reel.partial/` beside the script), to be superseded when the level is created.
- **Open:** the data folder's paths on each system, the default output path, and how a finished reel is moved in.

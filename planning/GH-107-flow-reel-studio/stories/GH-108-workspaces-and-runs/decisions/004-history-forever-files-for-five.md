# 004: A run's history is kept forever, and its heavy files for the last five finished runs of its script

**Date:** 2026-11-25 (grilling, Q4; agreed: "1, keep history forever, heavy files for last 5")

**Question:** how long is a run's data kept?

**Decision:** **the journal and logs are kept forever; the recording, voice clips and video are kept for the last 5 finished
runs of each script, a configurable number.** Runs that can still be resumed are never trimmed on their own.
`flow-reel clean` shows what would go and asks first. An older run stays listed, marked as having its files removed.

- **Why:** enough to compare with, and the growth is bounded without dropping unfinished work.
- **Measured:** 3 to 35 MB of working files for the short test reels; a real app will be bigger and wasn't measured.
- **Accepted cost:** an older result than those 5 can't be replayed.
- **Not chosen:** deleting the files when a run is done (only the reel in the project could be replayed); keeping everything
  until a person cleans (the folder grows out of sight).

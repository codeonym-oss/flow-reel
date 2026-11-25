# 001: The tracker holds the runs that ended, and the rest is read from their journals

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **`tracker.db` in the data folder keeps a run's summary once it has ended, with the size of the journal it was made
from. A journal of another size, and a run that is going, are read. A tracker that is damaged or of another version is
removed and filled again; one that is busy is done without.**

- **Why:** a run that is going can die without a word, so nothing kept about it could be trusted. The size tells a resumed
  run apart, because a journal only grows.
- **Accepted cost:** the first listing after an upgrade reads every journal.

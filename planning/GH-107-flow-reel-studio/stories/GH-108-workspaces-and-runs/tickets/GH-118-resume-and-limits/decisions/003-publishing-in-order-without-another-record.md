# 003: Publishing in order is worked out from the runs' journals

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **a run publishes with its workspace's publish lock held, unless a run started after it, with its reel in the same
place, has begun to publish. It is done either way, and says where its reel is. Built here, not in #119, because a resumed run
needs it.**

- **Why:** a run's journal says it began to publish before it touches the reel, so whoever holds the lock can't miss a newer
  one. A separate record of what was published could disagree with the journals.
- **Accepted cost:** when the newer run dies while publishing and is never resumed, the reel in place can be older than both.

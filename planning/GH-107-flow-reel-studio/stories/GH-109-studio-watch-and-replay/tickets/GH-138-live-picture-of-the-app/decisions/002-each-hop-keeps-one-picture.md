# 002: Each hop keeps at most one picture waiting

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** story decision 009 says a slow watcher gets only the newest picture. Where is that enforced?

**Decision:** **at every hop.** The container drops a picture while its output still holds unsent bytes; the run's process
and the studio each keep one picture per watcher while its socket is busy, replaced by a newer one and sent when the
socket drains.

- **Why:** a slow studio can't slow the run's process, and a slow tab can't slow the studio or the container: memory
  stays flat whoever is slow.
- **Accepted cost:** a jerky picture on a busy computer.

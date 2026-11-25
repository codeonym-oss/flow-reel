# 016: A run's owner holds a lock the operating system releases when it dies

**Date:** 2026-11-25 (chosen alone, 013)

**Question:** epic 031 says the run's process holds a lease that expires. With a lease renewed on a timer, a computer that
sleeps, or a process that is briefly blocked, loses its lease while it still lives, and two processes can own one run.

**Decision:** **the owner holds a file lock for as long as it lives, taken through SQLite (`BEGIN EXCLUSIVE` on a small file
in the run's folder).** The operating system drops it when the process ends, however it ends, so a dead owner is noticed at
once and a sleeping one is never replaced. Whoever takes a dead run's lock may write its journal, once, to record that it
stopped.

- **Refines epic 031:** same purpose, without the clock.
- **Why SQLite:** Node has no file locks of its own, and Node's built-in SQLite takes the system's on Linux, macOS and
  Windows without another package.
- **Not chosen:** a timed lease (above); a lock file with a process id (ids are reused, and two processes can replace a stale
  one at once); the control socket (a stale Unix socket can be replaced by two processes at once).

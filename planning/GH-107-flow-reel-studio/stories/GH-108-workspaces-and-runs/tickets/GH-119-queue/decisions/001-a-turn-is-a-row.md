# 001: A turn at heavy work is a row in a small database, and lasts as long as its run's owner

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **a run asks for its turn by adding a row to `queue.db` in the data folder; the rows' order is the queue. A run goes
when no row before its own belongs to a run that has an owner. Rows of dead runs are removed by whoever meets them.**

- **Why:** a plain lock is taken by whichever process tries first, not by who asked first. Whether a run lives is already
  known from its lock (016), so a turn needs no lease of its own.
- **Accepted cost:** a waiting run looks four times a second. Runs of two accounts, or with two data folders, don't see each
  other.

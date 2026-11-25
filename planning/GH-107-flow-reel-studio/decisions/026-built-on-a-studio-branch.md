# 026: The work is integrated on a separate `studio` branch

**Date:** 2026-11-25 (grilling; agreed: "A, a separate studio branch")

**Question:** where does the work live until it is released?

**Decision:** **on a `studio` branch. Each ticket is a pull request into it; `main` stays at 0.7, and its fixes are merged
into `studio`.** CI already checks pull requests into any branch, and releases start only from `main`.

- **Why:** 0.7 can still be fixed and released, and nothing unfinished can be published by accident.
- **Accepted cost:** keeping the branches together, and one large merge at the end.
- **Not chosen:** `main` with the release pull request left unmerged (0.7 can't be fixed); `main` behind a switch (old and
  new designs live together).

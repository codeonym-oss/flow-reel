# 001: Speed factors are greater than 1 and at most 16, fractions allowed

**Date:** 2026-11-16 (ticket pass, Q1; the person answered "ok" to the recommendation)

**Question:** which speed factors may a script give `speedUp`?

**Decision:** **any finite number greater than 1 and at most 16**, fractions included (1.5, 2.5). Anything else (1
or less, above 16, not a number) throws where `speedUp` is written, like the other effect words' checks.

- **Why:** covers the person's ×1.5 example and very long waits (2 minutes at ×16 is 7.5 s); beyond that, frames
  dropped make the picture jump, and `skip` (GH-62) is the better tool.
- **Not chosen:** whole numbers 2-8 only (no ×1.5); no upper bound.

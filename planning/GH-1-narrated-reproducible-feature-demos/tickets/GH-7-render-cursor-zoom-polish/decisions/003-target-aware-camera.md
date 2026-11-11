# 003: Optional target bounds keep the camera framing the element

**Date:** 2026-11-11 (ticket pass, Q3; agreed: "ok")

**Question:** add optional target bounds to click and typing events, or frame existing click points alone?

**Decision:** **add optional target bounds to click and typing events**, retaining compatibility with existing version 1 logs. The camera follows the cursor smoothly, clamps its crop inside the recorded frame, and reduces magnification below the decision 001 cap when necessary to fit the target with padding. Existing logs without bounds use click positions as their fallback, without a whole-element visibility guarantee.

- **Why:** a click point alone cannot establish whether the whole element remains visible; bounds make the ticket's framing check meaningful.
- **Not chosen:** point-only framing for all logs (large targets can be cropped); requiring bounds in old logs (breaks compatibility).

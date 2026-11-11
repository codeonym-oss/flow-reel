# 004: One consistent cursor and click ripple style

**Date:** 2026-11-11 (ticket pass, Q4; agreed: "ok")

**Question:** one consistent style or OS-specific cursor styles?

**Decision:** **ship one bundled white arrow with a dark outline**, at a constant delivery-screen size during zoom. Draw a blue ring at each click; it expands and fades over 400 ms. Use the same assets and behavior on every host.

- **Why:** readable on light and dark pages, consistent across recordings, and avoids platform-dependent assets and testing.
- **Not chosen:** per-OS styles (more assets and verification without improving the core demo flow).

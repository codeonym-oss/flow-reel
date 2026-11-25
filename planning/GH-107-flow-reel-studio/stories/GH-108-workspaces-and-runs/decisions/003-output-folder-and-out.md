# 003: Reels go to `reels/out` by default, and `--out` sends one compose's reel elsewhere

**Date:** 2026-11-25 (grilling, Q3; agreed: "2, reels/out by default and keep --out")

**Question:** where do finished reels go by default, and can one compose send its reel elsewhere?

**Decision:** **`reels/out`, changed by `"output"` in `flow-reel.json`; `--out <dir>` overrides it for one compose.**
Subfolders are kept: `reels/admin/refund.reel.ts` gives `<output>/admin/refund.reel/`. Two scripts that would give the same
reel, such as `a.reel.ts` and `a.reel.js`, are refused. A run remembers where it published.

- **Why:** CI writes its result somewhere temporary, and `flow-reel compare` needs two reels side by side.
- **Accepted cost:** a reel sent elsewhere isn't the script's reel: the script's own reel stays as it was.
- **Not chosen:** no `--out` (trying something once means changing the config); `demos/` (a second top-level folder, and a
  common name that may be taken).

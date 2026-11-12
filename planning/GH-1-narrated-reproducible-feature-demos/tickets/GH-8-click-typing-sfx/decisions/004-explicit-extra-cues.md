# 004: Automatic click/typing sounds plus explicit extra cues

**Date:** 2026-11-11 (ticket pass, Q3; agreed: "ok")

**Question:** should extra action sounds be explicitly triggered or inferred from browser activity?

**Decision:** **keep click and per-character typing sounds automatic, and let demo authors explicitly trigger other named cues**, using a script helper such as `sfx("success")`. Log these cues on the same clock as existing runner actions and retime them with the final timeline. Settle the exact helper contract and cue set in the remaining ticket pass.

- **Why:** the author knows when an operation succeeded, failed or opened a panel; explicit intent avoids brittle UI heuristics and unwanted sounds.
- **Not chosen:** automatic semantic detection based on DOM changes, network responses or guessed meanings of browser actions.

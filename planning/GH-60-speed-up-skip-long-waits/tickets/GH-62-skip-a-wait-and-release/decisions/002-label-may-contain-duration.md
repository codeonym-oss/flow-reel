# 002: The card shows the cut length; `label` may place it with `{duration}`

**Date:** 2026-11-16 (ticket pass, Q2; the person answered "ok" to the recommendation)

**Question:** what does the card say, and how does `label` deal with a length that changes every compose?

**Decision:** the default text is "⏭ {duration} skipped". `{duration}` is the real length cut, rounded to whole
seconds: "38 s" under a minute, "1 min 52 s" from a minute on ("2 min" when the seconds are 0). `label` replaces the
words after the `⏭`, which always stays; a `{duration}` in it is filled in the same way, and a label without one shows
as written: `skip(fn, { label: "{duration} plus tard" })` shows "⏭ 38 s plus tard".

- **Why:** a translated card can still show the real length; "s" and "min" read the same in most Latin-script
  languages.
- **Not chosen:** plain-text `label` only (a translated card can't show the length); `label` replacing the `⏭` too.

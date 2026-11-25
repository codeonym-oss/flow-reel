# 003: `--json` prints the journal's entries, each with its run

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **one JSON object per line on the output: the entry, and `run`, such as `shop/12` (the workspace's name on this
computer and the run's number). Lines for people go to the error output.** A run's id is its number in its workspace; the
workspace is named before it when it isn't the current one. Closes 008's open question.

- **Why:** one format to document, the journal's. Numbers say the order, can be typed, and need no quoting in a shell, unlike
  `checkout#12`.

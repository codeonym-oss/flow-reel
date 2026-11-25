# 014: There is one kind of run: it runs to its end by itself, and can be intercepted

**Date:** 2026-11-25 (the person's correction: "all runs are autonomous and interceptable, but only studio (for now the
webapp) can do it … later, if we upgraded the cli to a tui, then it may as well … so there is a unique structure for the
runs")

**Supersedes 013.**

**Decision:** **every run has the same structure. It starts autonomous and runs to its end, and it can be intercepted.**
Which client can intercept is not part of the run: the studio can now, and a TUI could later. The interface must take
further kinds of interception.

- **Why:** one structure for every run, whoever started it, and clients can gain abilities without changing runs.
- **Open:** what happens when the client that intercepted disappears; the exact commands.

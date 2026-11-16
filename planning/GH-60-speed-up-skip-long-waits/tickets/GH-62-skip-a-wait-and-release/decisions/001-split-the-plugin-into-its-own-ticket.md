# 001: The plugin's teaching moves to its own ticket

**Date:** 2026-11-16 (ticket pass, Q1; the person answered "ok!" to the recommendation)

**Question:** GH-62 held the runtime word `skip`, release 0.4.0 and the plugin's teaching. A plugin `feat:` commit
must touch only `plugin/` (or it cuts a runtime release too), so the runtime and the plugin can't share one PR.

**Decision:** **split.** GH-62 keeps `skip` (runtime, tests, README) and release 0.4.0 (merging release-please's PR,
checking npm and the image). A new ticket under GH-60 teaches `speedUp` and `skip` in the plugin, in a plugin-only
PR, and ships its own plugin release after 0.4.0 is out.

- **Why:** one ticket, one PR; the plugin-only rule holds without a commit override.
- **Not chosen:** one ticket with several PRs; one PR with `BEGIN_COMMIT_OVERRIDE` (fragile).

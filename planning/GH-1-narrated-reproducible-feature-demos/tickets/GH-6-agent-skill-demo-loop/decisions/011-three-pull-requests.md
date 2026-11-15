# 011: One ticket, three pull requests: plumbing, the suite, the listing

**Date:** 2026-11-15 (re-plan for 0.2, Q6; agreed: "ok")

**Question:** how does GH-6 ship, now that it spans the release workflow, the plugin's content and another
repository's catalogs?

**Decision:** **one ticket, three pull requests**, the first two `Part of #6`:

1. **Plumbing** (flow-reel): the second release-please component `flow-reel-plugin` (decision 005), both
   manifests, `language.md` with the range and its test (decision 010), `publish.yml` called only for a runtime
   release; a release-please dry run shows a `plugin/`-only change proposes only a plugin release. With a yes,
   `groundwork.md`'s rule on `feat:`/`fix:` also names the plugin, since a `feat:` touching only `plugin/` now cuts a
   plugin release.
2. **The suite** (flow-reel): `reel`, `reshoot`, `screening`, the other references, the two helpers, the sample
   app. Before it merges, one fresh agent session with the packaged plugin makes a reel of the sample app. Its
   release is plugin 0.1.0.
3. **The listing** (`codeonym-oss/claude-plugins`): flow-reel in both catalogs with `git-subdir` sources, then
   installs in clean clients where available. It closes #6.

- **Why:** a release-workflow mistake surfaces in a small first pull request, before the content depends on it.
- **Not chosen:** a separate ticket for the listing (an issue for a small JSON change, and GH-6 would stop short of
  an installable plugin); plumbing and suite in one pull request (a large review mixing workflows and Markdown).

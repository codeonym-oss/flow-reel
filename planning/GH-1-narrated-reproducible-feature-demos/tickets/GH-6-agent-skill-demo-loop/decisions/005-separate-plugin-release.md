# 005: The plugin lives in `plugin/` and releases separately from the runtime

**Supersedes 002** in part: its version authority and repository-root layout. Distribution through both
organization catalogs, keeping the suite in `codeonym-oss/flow-reel`, and not copying groundwork's `VERSION` file
still stand.

**Date:** 2026-11-13 (audit follow-up; agreed: "Separate plugin component (Recommended)")

**Question:** should the plugin share the npm package's version, with its files at the repository root?

**Decision:** put every installable plugin file under `plugin/`, and release it as a second release-please package
(component `flow-reel-plugin`, tags `flow-reel-plugin-vX.Y.Z`, its own `plugin/CHANGELOG.md`). Both manifests take
their `$.version` from that component. The runtime package `.` keeps `vX.Y.Z` tags. Commits that only touch `plugin/`
must not cut a runtime release, and a plugin release must not trigger `publish.yml`.

Both catalogs point at the subdirectory with their documented `git-subdir` source (`url` = the repository, `path` =
`plugin`). Claude Code then sparse-checks out only that folder into its cache. Codex documents the same source
type. Following the existing catalogs, they track the default branch rather than a pinned `ref`. A client sees a
new plugin version only when the release PR changes the manifest `version`.

The plugin states the runtime versions it supports in `references/demo-api.md`. `preflight.mjs` checks the selected
runtime against that range and reports a mismatch. It never installs or upgrades anything.

- **Why:** every runtime release rebuilds and publishes two ~7 GB images and an npm version. Coupling the versions
  would cut an identical-runtime release for every skill or wording change, which is the 0.1.1 / #21 problem.
  Installing the whole repository would also ship `planning/` (with the SFX audition library), `test/`, `src/` and
  `docker/` to every client. And the "resolves without the checkout" check would test a minimal copy that clients
  never actually install.
- **Not chosen:** one shared version with a `plugin/` folder, which still costs an image rebuild per skill change;
  a separate repository, which loses the single source tree that decision 002 wanted; and pinning catalog entries
  to plugin tags, which needs a marketplace PR for every plugin release and breaks with organization convention.

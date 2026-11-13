# 002: Follow groundwork's Claude Code and portable plugin distribution

**Superseded in part by 005** (version authority and repository-root layout).

**Date:** 2026-11-13 (requested: "for publishing it, check the groundwork config repo!"; implementation choice within the user's delegated approval)

**Question:** where does the suite live and how is it discovered?

**Decision:** keep skills, shared references, scripts and templates in `codeonym-oss/flow-reel`. Add `.claude-plugin/plugin.json` and root `plugin.json`, following the inspected groundwork layout. Register `flow-reel` in both catalogs in `codeonym-oss/claude-plugins`: `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`. Provide Claude Code and Codex installation/invocation guidance, with plain skill text reusable by other compatible agents without claiming their installs have been tested.

This expands GH-6's original Claude-only packaging scope; the user requested a rich agent suite and specifically identified the now-portable groundwork reference. Do not change groundwork itself.

Use the existing Node release-please configuration in flow-reel and add JSON version updates for both manifests. npm/package-lock remain the version authority; do not copy groundwork's separate `VERSION`/simple-release strategy. Skills and helpers stay out of the npm runtime tarball and recording image unless a concrete runtime dependency requires otherwise (none is planned).

- **Why:** one maintained source tree, one runtime version, and the organization's established distribution channels.
- **Not chosen:** a new skill-only repository, an independent plugin release train, a marketplace inside flow-reel, or a required browser MCP server.

**Inspected evidence:** groundwork main `aa6f5eab73bbb94ff00f4dacd8f0f323e4fc5a8a`; marketplace main `4eadb33293e067353bfa13ff30fa06b73c7ca706`. File-level sources and release sequencing are recorded in `publishing.md`.

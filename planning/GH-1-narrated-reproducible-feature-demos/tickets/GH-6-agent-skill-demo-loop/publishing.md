# GH-6: Publishing the plugin

Re-planned 2026-11-15 for 0.2 (decisions 005, 010, 011). The first version is in
`history/2026-11-15_1306_publishing.md`.

## What the reference repositories do

Re-read 2026-11-15; unchanged since the first plan:

- [groundwork Claude manifest](https://github.com/codeonym-oss/groundwork/blob/aa6f5eab73bbb94ff00f4dacd8f0f323e4fc5a8a/.claude-plugin/plugin.json):
  metadata and explicit `./skills/<name>` entries.
- [groundwork portable manifest](https://github.com/codeonym-oss/groundwork/blob/aa6f5eab73bbb94ff00f4dacd8f0f323e4fc5a8a/plugin.json):
  the agent-plugins schema and `extensions.com.openai` onboarding metadata.
- [groundwork consistency tests](https://github.com/codeonym-oss/groundwork/blob/aa6f5eab73bbb94ff00f4dacd8f0f323e4fc5a8a/tests/test_repo.py):
  listed skills exist, versions agree, referenced files exist.
- [Claude catalog](https://github.com/codeonym-oss/claude-plugins/blob/4eadb33293e067353bfa13ff30fa06b73c7ca706/.claude-plugin/marketplace.json)
  and [Codex catalog](https://github.com/codeonym-oss/claude-plugins/blob/4eadb33293e067353bfa13ff30fa06b73c7ca706/.agents/plugins/marketplace.json):
  `groundwork` and `design-skills`, tracking the default branch.

They are precedents, not things to copy wholesale (groundwork's `VERSION` file, its icons, its policies).

## In flow-reel (pull requests 1 and 2)

Paths are relative to `plugin/`.

1. `.claude-plugin/plugin.json`: name `flow-reel`, the component's version, MIT, the skills `./skills/reel`,
   `./skills/reshoot`, `./skills/screening`.
2. `plugin.json`: the portable schema, the same name and version; onboarding skill `./skills/reel/SKILL.md`;
   interface text about narrated reels of a web app's features. No authentication or tool dependencies declared.
3. release-please: package `plugin`, component `flow-reel-plugin`, tags `flow-reel-plugin-vX.Y.Z`,
   `CHANGELOG.md`, `extra-files` for both manifests' `$.version`, `initial-version: 0.1.0`. The root package keeps
   `vX.Y.Z` and `package.json`, excludes `plugin/`, and is the only one that runs `publish.yml`.
4. The npm `files` allowlist (`dist`, `docker`) and the image stay as they are; a test proves no plugin file is in
   the package.
5. `references/language.md` holds the supported range `>=0.2.0 <0.3.0`; a unit test ties it to `package.json`.

## In `codeonym-oss/claude-plugins` (pull request 3)

- `.claude-plugin/marketplace.json`: a `flow-reel` entry with source
  `{ "source": "git-subdir", "url": "codeonym-oss/flow-reel", "path": "plugin" }`.
- `.agents/plugins/marketplace.json`: a `flow-reel` entry with source
  `{ "source": "git-subdir", "url": "https://github.com/codeonym-oss/flow-reel.git", "path": "./plugin" }`, and
  the catalog's availability and category fields as the other entries have them.
- Both source forms are re-checked in the clients' docs before the pull request. Existing entries and the
  marketplace name `codeonym-oss` are kept; groundwork itself is not touched.

## Order and checks

1. Pull request 1 merged; dry runs show each component releases alone.
2. Pull request 2 merged after its tests, the e2e sample and the agent trial; the `flow-reel-plugin` 0.1.0 release
   PR merged. Check: the tag, both manifests at 0.1.0, no `publish.yml` run.
3. Pull request 3 opened with links to the release and the trial; merged after review.
4. Clean installs:

   ```text
   # Claude Code
   /plugin marketplace add codeonym-oss/claude-plugins
   /plugin install flow-reel@codeonym-oss

   # Codex CLI
   codex plugin marketplace add codeonym-oss/claude-plugins
   codex plugin add flow-reel@codeonym-oss
   ```

   In each client available: the three skills listed, a reference opened from the installed cache, `preflight.mjs
   --help` run from there. A client not available is named as untested.
5. Close #6 by hand (a pull request in another repository can't close it), Done on board 6, ticket `done`.

The plugin and a project's runtime update separately; `preflight.mjs` reports a pairing outside the range.

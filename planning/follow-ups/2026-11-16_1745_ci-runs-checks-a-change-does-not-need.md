---
status: open
from: person
found-while: GH-66
resolved-by:
---

# CI runs checks a change doesn't need, and misses the cheap ones it does

The person asked (2026-11-16) for the CI pipelines to be designed as a whole, after GH-66's fast path (#68, #73)
showed how much a patch on the old shape leaves:

- **Plugin release PRs run the full image build and e2e.** release-please's plugin release PR (#75) changes
  `plugin/` and `.release-please-manifest.json`. The manifest is a root file that isn't Markdown, so `changes` in
  `.github/workflows/ci.yml` outputs `runtime=true`, and both arch jobs build the image and run e2e (about 20
  minutes each) for a version bump. Every plugin release PR will do this.
- **The unit tests run three times on the fast path.** `minimum-node` and both `test (amd64|arm64)` jobs run
  `npm ci` and `npm test`, so a planning-only PR runs the same tests three times (about a minute each).
- **The arch matrix starts even when `runtime=false`,** only to skip most of its steps: two runners spin up and
  install ffmpeg for nothing.
- **The path rules are one awk line** in `changes`, written as exceptions ("not planning, not Markdown, not the
  plugin but its examples"). Each new file kind is a guess about which side it falls on, as the manifest shows.
- **`publish.yml` reruns e2e from the tag** (see the memory on publish tests), so a release runs the image tests
  that main CI already ran on the same commit.

Left for later because GH-60's PRs (#73, #74, #75) should merge as they are first; changing CI again would rerun them.

A fix starts from a table: each kind of change (runtime source, image, plugin, plugin examples, release manifests,
planning, docs, workflows) against the checks it needs (typecheck, unit tests on the minimum Node and on Node 26,
pack check, image build per arch, e2e, consumer, plugin tests). Then: the path rules list what *is* runtime rather
than what isn't; jobs that a change doesn't need are skipped at the job level, not step by step; the unit tests run
once per Node version; a release manifest counts as runtime only together with `package.json`; and the branch
protection's required checks are adjusted so skipped jobs still let a PR merge. It is a `ci:` change, worth a ticket
of its own.

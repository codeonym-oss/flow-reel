# 012: The plugin states only the oldest runtime it supports

**Date:** 2026-11-23 (GH-98; agreed: "Lower bound only")

**Supersedes 010.**

**Question:** the range `>=0.5.0 <0.6.0` fails every runtime minor release's CI until a plugin release widens it
(0.3, 0.4, 0.5 and now release PR #97 for 0.6). What should the plugin claim?

**Decision:** **a lower bound only, `>=0.5.0`, written in `plugin/references/language.md`.** `preflight.mjs` still
reports a runtime older than it. The unit test still ties the claim to `package.json`, now as "at least".

- **Why:** a runtime release is no longer blocked on a plugin release. A language break the plugin teaches is still
  caught where it matters: the plugin's e2e composes the saved-views example on every runtime change.
- **Not chosen:** widening the range on each minor (a plugin PR before every runtime release); no range at all (a
  runtime older than the words the plugin teaches fails at compose instead of at preflight).
- **Cost accepted:** a runtime change that breaks a word the example doesn't use can ship before the plugin is
  updated.

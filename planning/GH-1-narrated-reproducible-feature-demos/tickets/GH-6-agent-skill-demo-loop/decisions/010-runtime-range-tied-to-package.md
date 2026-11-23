# 010: The plugin supports `>=0.2.0 <0.3.0`, and a test ties the range to `package.json`

**Superseded by 012.**

**Date:** 2026-11-15 (re-plan for 0.2, Q5; agreed: "ok")

**Question:** the plugin and the runtime release separately (decision 005), and before 1.0 a minor release breaks
the language. Which runtime versions does the plugin claim, and what keeps the claim true?

**Decision:** **`>=0.2.0 <0.3.0`, written once in `plugin/references/language.md`.** `preflight.mjs` reads it and
reports a runtime outside it. A unit test fails when `package.json`'s version is outside the range, so the runtime
pull request that moves to 0.3.0 also updates the plugin, or widens the range on purpose.

- **Why:** the plugin teaching one language while the runtime speaks another is its most likely failure; the test
  catches it in the pull request that causes it.
- **Not chosen:** the range with no test (drift unnoticed); one exact version (a plugin release for every runtime
  patch).

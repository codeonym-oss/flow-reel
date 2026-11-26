# 001: The plugin may state the next minor version while it is being built

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Refines GH-6 decision 012.**

**Question:** the plugin now teaches what only 0.8 has, while `package.json` says 0.7.0 until the release. Which oldest runtime
does it state?

**Decision:** **`>=0.8.0`, stated now. The test that ties it to `package.json` accepts the next minor version too.**

- **Why:** stating it at release time, as 0.5 did, can be forgotten, and the plugin would then teach 0.7 users words they
  don't have.
- **Accepted cost:** the runtime's release has to be published before the plugin's. Both are released by hand from `main`.
- **Not chosen:** keeping `>=0.5.0` until the release (false in between); setting `package.json` by hand (release-please owns
  it).

# 001: Widen the range for the release, then narrow it to 0.4

**Date:** 2026-11-16 (ticket pass; the cleanup asked for by the person: "only keep the optimized current working
content")

**Question:** The draft moved the plugin's minimum runtime to 0.4.0. But the plugin's consistency test needs the
package's own version inside the plugin's supported range, so release PR #64 (0.4.0) failed CI until the range
admitted 0.4.0, while a range starting at 0.4.0 fails while the package is still 0.3.1.

**Decision:** **two plugin PRs around the release.**
1. Before #64: the teaching, with the range `>=0.2.0 <0.5.0` (PR #69). release-please put it in #64 beside 0.4.0, so
   plugin 0.3.0 shipped with it.
2. After 0.4.0 was published: the range `>=0.4.0 <0.5.0`, with the per-version notes and preflight's
   cloud-voice-on-0.2 branch removed (PR #72), released as the next plugin version. The preflight tests moved to 0.4
   first, in a `test:` PR (#71) that passes under both ranges.

- **Why:** the merge order works with the plugin-only rule (GH-62 decision 001), and the plugin ends up teaching only
  the current runtime, with no version exceptions to remember.
- **Not chosen:** a per-script check for `speedUp`/`skip` on old runtimes (built, then dropped: the 0.4 range makes
  it dead code); one PR for the plugin and the tests (a `feat:` touching `test/` cuts a runtime release).

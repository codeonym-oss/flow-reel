---
status: open
from: agent
found-while: GH-56
resolved-by:
---

# The effects e2e test fails when two real composes drift more than 150 ms apart

`test/e2e/record.test.ts:185` ("verifies, and gives the same effects on a second compose, which compare checks")
composes the same script twice in the real image and expects `flow-reel compare` to exit 0, which allows step starts
and effects to differ by at most 150 ms. On a busy CI runner two real recordings can drift further, so the test fails
with `status: 1` while nothing is wrong:

- #50's CI, arm64 (2026-11-15), off by 999 ms; a rerun passed;
- main CI after release #59, amd64, run 43830555944 (2026-11-16); rerun.

It gates publishing too: `publish.yml` runs `test:e2e` from the release tag, so a failure there holds npm and the
image until a rerun passes.

A fix keeps the check meaningful without depending on runner speed, e.g. compare the two composes' effect order and
step structure exactly and their times only relative to their own steps, or compare one compose against a stored
expected event log. It is a test change (`test:`), no release.

# 003: The tests of what runs on the person's computer run on all three systems

**Date:** 2026-11-26 (chosen alone, story decision 013)

**Decision:** **the `systems` job runs every unit test except those of code that runs only in the composer image or only
in CI: `test:systems` names them. In `plugin-helpers.test.ts`, preflight's tests don't run on Windows, and stills' run on
Linux only. Every text file is checked out with LF.**

- **Why:** the image is Linux, so its code (voices, the recorder, the Playwright loader) and the release scripts never
  run on macOS or Windows, and their tests need the runner's ffmpeg or Docker. A new test runs on all three by default,
  so forgetting to list one fails loudly instead of leaving it unchecked.
- **Why not all of them:** run there, 25 failed on macOS and 50 on Windows, all for those reasons, or for two test bugs
  (a path in JSON, a `/` in a pattern) and Windows' CRLF checkout.
- **Accepted cost:** preflight on Windows is checked by the person (its fakes are shell scripts), and so are stills on
  macOS and Windows (their reels are made with ffmpeg).

# Plan: the image check without holding up the studio (GH-147)

1. A unit test: while `ensureImage` waits on a slow engine, timers keep firing. → check: it fails today (no tick in 1.2 s).
2. `ensureImage` spawns its engine commands and awaits them; `startCompose` and `resumeRun` await it. → check: the test
   passes; every unit test passes; typecheck is clean.

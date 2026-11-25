# 002: A container's output holds messages only; everything else is the log

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **the container's output is JSON lines, one message each; a script's `console.log`, Chromium and ffmpeg go to
the error output, which is the run's log.** A failed phase says why in its last message. The image and the package are the
same version, so the protocol carries no version of its own; the files of a run do, because a run outlives an upgrade.

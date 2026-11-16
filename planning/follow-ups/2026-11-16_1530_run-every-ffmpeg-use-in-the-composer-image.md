---
status: open
from: person
found-while: GH-61
resolved-by:
---

# Every ffmpeg use runs inside the composer image; hosts and CI runners don't install ffmpeg

The person's rule (2026-11-16): "Everything shall happen inside the composer image, even ffmpeg installation!!"

The composer itself already does: capture, render, polish, voicing and sounds run in the image. What still needs
ffmpeg or ffprobe on the host:

- **CI:** `ci.yml` (lines 23, 45) and `publish.yml` (lines 95, 239, 327) `apt-get install ffmpeg` on the runner.
- **E2E tests that call the renderer directly:** `test/e2e/render.test.ts`, `polish.test.ts`, `sfx.test.ts`,
  `tts.test.ts` run `renderTimeline` and friends in the test process, with the host's ffmpeg.
- **Probes in the tests:** `test/e2e/record.test.ts` (`ffprobe`, `ffmpeg` to read frames and make images).
- **`scripts/consumer.ts`** probes the consumer's reel with `ffprobe`.

Found during GH-61: the host's ffmpeg differs from the image's, so results differ. Arch's `/usr/bin/ffmpeg` reports
`n9.0.2`, which `render.ts`'s version check (`/ffmpeg version (\d+)/`) can't read, so the render e2e tests fail on
that host even on `main`; the linuxbrew build has no `drawtext`. GH-61's render, polish and sfx tests were run inside
the image by hand (`docker run --entrypoint sh … npx vitest run …`).

A fix runs those tests and probes in the image built for the run (the one `prepareImage` gives), drops the runners'
ffmpeg installs, and with only the image's FFmpeg 6 left, the `-/filter_complex` branch for FFmpeg 8+ in `render.ts`
can go. It is a test and CI change (`test:`/`ci:`), plus that small `render.ts` clean-up (`fix:` only if it ships).

- 2026-11-19: issue #92 created from the 2026-11-16 CI follow-up; drafted, planned and built in one session at the
  person's request ("build it and ship it").
- 2026-11-19: first full run: shards take 3½-4½ min of tests; amd64 lost 7-9 min to apt ffmpeg, so e2e runs ffmpeg in
  the image and unit moves to arm64 runners.
- 2026-11-19: merged in PR #93 (1590b82); status done. e2e jobs: arm64 6-9 min, amd64 10-14 min, down from 20-48.

# Plan: Replay a reel in the studio (GH-140)

Decisions relied on: story GH-109 006, 007, 008; GH-139 001 to 004; this ticket's 001 to 004.

## Read first

- `src/host/retention.ts` (the run's `reel/`), `src/composer/schema/transcript.ts`, `src/composer/schema/manifest.ts`.
- `src/studio/server.ts`, `src/host/score.ts`, `web/src/score.tsx`, `web/src/run.tsx`, `web/src/app.tsx`.

## Steps

1. **The reel's data:** `GET /api/reel?run=` (transcript steps, marks from events, files, size, duration) and
   `GET /api/reel-file?run=&path=` for the manifest's files only, with `Range`.
   → check: unit tests: a reel's answer; a range answers 206 with the right bytes; a path outside the manifest is 404.
2. **The score as a view:** split `Score` into the drawing (steps, marks, duration, playhead, seek) and the Run
   screen's data.
   → check: the Run screen looks and works as before.
3. **The Reel screen:** the video with captions, the transport, the transcript, the score following the playhead,
   the files, the numbers and the level strip; the list of reels without a run in the path.
   → check: in Chrome on a real reel: clicking a step or a line plays from there; the playhead and the score stay
   together while playing and scrubbing; loop, speed and captions work; light, dark and 375 px.

## Risks

- Seeking needs ranges: without them Chrome can't scrub an MP4 served by the studio.

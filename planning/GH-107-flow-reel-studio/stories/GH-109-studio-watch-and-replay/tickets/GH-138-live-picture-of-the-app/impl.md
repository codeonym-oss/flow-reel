# Plan: The live picture of the app (GH-138)

Decisions relied on: epic 029 (gate 4); story GH-109 002, 009; this ticket's 001 to 004.

## Read first

- `src/container/protocol.ts`, `src/container/main.ts`, `src/host/container.ts`: the container's pipes.
- `src/composer/media/display.ts`, `src/composer/media/recording.ts`, `src/composer/phases/record.ts`.
- `src/host/control.ts`, `src/run/control.ts`, `src/host/owner.ts`, `src/host/run-process.ts`, `src/host/compose.ts`.
- `src/studio/server.ts` (`watchRun`), `src/studio/websocket.ts` (`buffered`), `web/src/run.tsx`.

## Steps

1. **Protocol:** a `picture` container message, the `watch`/`unwatch` input lines, a `target` progress.
   → check: typecheck.
2. **The grab** (`src/composer/media/pictures.ts`): ffmpeg under nice, JPEGs cut from its output; the container starts it
   on `watch` while recording and stops it on `unwatch`; record reports targets.
   → check: unit test for cutting JPEGs from chunks; in the image, a watched recording sends pictures.
3. **The run's process:** a `Screen` that counts watchers, tells the record container, and keeps one picture per watcher;
   the `picture` command on the control socket; `watchPictures` for clients.
   → check: unit tests: no watcher, no `watch` line; the first watcher sends `watch`, the last one `unwatch`; a busy
   watcher gets only the newest picture.
4. **The studio:** while a watched run records, it asks for pictures and sends them as binary messages, one waiting at
   most per tab.
   → check: unit test with a fake run's process.
5. **Web:** the picture in the stage, the target over it, a Targets switch.
   → check: in Chrome on a real compose: the app shows live, the targets follow.
6. **Gate 4:** compose the same script with and without a watcher; compare the record phase's time, the capture's
   missing frames and the CPU.
   → check: within 5 % of the time, no new missing frames; numbers in the PR.
7. **Docs:** the CLI reference's Run paragraph.

## Risks

- ffmpeg's `x11grab` must find the display: the container retries until it is there.
- A JPEG ends with FF D9; ffmpeg writes no thumbnails, so cutting on it is safe.

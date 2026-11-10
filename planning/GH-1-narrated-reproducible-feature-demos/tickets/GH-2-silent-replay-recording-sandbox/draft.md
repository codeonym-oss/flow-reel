# Replay a demo script on a virtual display and write a silent MP4 with step timings

## Problem

There is no way to record an agent's demo headlessly and reproducibly: the existing `screen-recording` skill assumes
OBS on a person's desktop.

## Change

- The container image: virtual display, Chromium, Playwright, ffmpeg.
- The npm package `flow-reel` with the `demo()` / `step()` API (story decision 010) and the CLI: on the host,
  `flow-reel record demo.ts` starts the image with the project mounted; inside, it replays the script and records.
- The runner's stabilisation from story decision 009: fixed viewport and device scale, `prefers-reduced-motion`, fixed
  clock and seed, network-idle wait before each step.
- Recording with Xvfb + ffmpeg into a 1440p near-lossless master at 30 fps in a self-ignoring `.flow-reel/` folder,
  plus a silent 1080p `demo.mp4` beside the script (decisions 001, 005, 006).
- A wrapped `page` that eases the mouse to each target and types visibly, so later polish can draw the cursor
  (story decision 012, this ticket's decision 002).
- `transcript.json` with `video` and each step's `index`, `startMs`, `actionEndMs`, `endMs` (story decision 011), and
  `events.json` with the runner's moves, clicks, typing and scrolls (story decision 013).
- Reaching an app on the host's `localhost` on Linux and Docker Desktop (decision 003); the image tagged with the npm
  version, built locally when it can't be pulled (decision 004).

## Out of scope

Narration, captions, audio (GH-3 to GH-5); drawing the cursor, zoom and SFX (later tickets); publishing images
(the release ticket).

## Done when

- `flow-reel record` on a sample app writes a 2560×1440 30 fps master in `.flow-reel/`, a silent 1920×1080
  `demo.mp4`, and a `demo.transcript.json` and `demo.events.json` that validate against version 1.
- Two runs of the same script have the same steps, every start within ±150 ms.
- A step's logged `startMs` matches the frame where it visibly starts, within ±2 frames.

## Decisions

This ticket's decisions 001-006 (recorder, wrapped page, reaching the host, image, 1440p master, output folder).

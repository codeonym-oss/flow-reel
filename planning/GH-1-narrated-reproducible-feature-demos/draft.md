# Record narrated, reproducible feature demos from an agent-written script

## Goal

Let a coding agent show the feature it built: it explores the app with whatever browser tool it has, writes a short
demo script, and one command turns that script into a narrated MP4 with captions and a timed transcript. The same
script gives the same video every time, so a demo can be re-recorded with one command when the UI changes. The demos
are for anyone who needs to see a feature: reviewers, clients, users (decision 001).

## What it delivers

`npx flow-reel record demo.ts` writes, next to the script:

- `demo.mp4`: the replayed demo with a TTS voice, a smooth cursor, click ripples, zoom on click, follow cursor and
  click and typing sounds;
- `demo.srt` and `demo.vtt`: captions;
- `transcript.json`: the steps, their narration, timing and audio (decision 011).

It runs in a headless container image (virtual display, Chromium, Playwright, ffmpeg, a local TTS voice); on the host
the CLI only starts the image (decisions 005, 006, 008). A Claude Code skill teaches agents the loop.

## Rules every ticket keeps

- **Explore, then script, then replay.** Recording never captures an agent driving the app live; a deterministic
  runner replays the script (decision 002).
- **The script API is `demo(options, ({ page, step }) => …)`**, one `step(narration, action)` per unit the runner
  times, voices and holds (decision 010).
- **`transcript.json` follows schema version 1**; each ticket fills only its own fields (decision 011).
- **"The same video"** means the same steps, narration, captions and audio, every step starting within ±150 ms of the
  other run; the runner removes the sources of variance it can (decision 009, which supersedes 003's done check).
- **Polish is rendered in post** from the runner's `events.json` and a 4K master; the recording itself stays clean
  (decisions 012, 013).
- **TTS sits behind an adapter**, local and keyless by default; cloud voices are optional (decision 004).
- **Agent-agnostic:** all logic lives in the CLI and the image; agent plugins stay thin (decision 005).

## Tickets, in the order they ship

1. Replay a demo script on a virtual display and write a silent MP4 with step timings
2. Narrate steps in the transcript and write SRT/VTT captions
3. Voice narration through a TTS adapter with a local default voice
4. Hold each step for its voice clip, mux the audio, and check sync and reproducibility
5. Render a smooth cursor, click ripples, zoom on click and follow cursor from the event log
6. Add click and typing sound effects mixed under the voice
7. Publish multi-arch images to GHCR and the package to npm on release
8. Teach agents the explore, script, record loop in a Claude Code skill

## Not part of this story

- Posting demos or previews on pull requests (a later story).
- Intro and outro cards, burned-in captions, background music (a later story). Cursor, zoom and SFX moved into this
  story (decision 012, which supersedes 003 and 007).
- Comparing frames between runs (perceptual hashing), noted in decision 009 as a possible later story.

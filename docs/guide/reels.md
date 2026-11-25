# Reels

A **reel** is the whole result of composing one script: one folder holding the video, the transcript, the
captions, the event log, the audio and a manifest.

```sh
npx flow-reel compose reels/settings.reel.ts                   # writes reels/out/settings.reel/
npx flow-reel compose reels/settings.reel.ts --out /tmp/reels  # writes /tmp/reels/settings.reel/
```

Reels go to the workspace's **output folder**, or to `--out <dir>`. Every reel has the same layout:

| File | What it is |
|---|---|
| `video.mp4` | The polished video: 1920×1080, 30 fps, with AAC speech and sounds. |
| `transcript.json` | Each step's original `comment`, and its `startMs`, `actionEndMs` and `endMs` on the video's timeline. |
| `events.json` | Every move, click, keystroke run, scroll, sound, effect, card and overlay, timed the same way, and whether zoom is automatic. |
| `captions.srt` | Captions for a video player. |
| `captions.vtt` | WebVTT captions for a browser's `<video>` and `<track>`. |
| `audio/000.wav` | Each step's speech clip, named by its zero-based step index. |
| `manifest.json` | Every file above with its size and SHA-256, the script's name and hash, the composer version and platform, the integration and the voice. |

Share the whole folder. It is yours to commit or not. What a run works on, such as the original recording, is in its
[run](runs.md#where-runs-are), not in the reel.

## A failed compose keeps the old reel

A run makes the new reel outside your project, and replaces the old one in one step, once it is whole. A run that fails,
stops or is cancelled leaves the previous reel as it was. It can often [resume](runs.md#resume-a-run).

## Captions and timing

- Each caption shows one step's comment from its `startMs` to its `endMs`. Whitespace is normalized, and the player
  wraps the text. The transcript keeps the original comment.
- Blank comments and steps lasting zero milliseconds stay in the transcript but produce no caption.
- Captions escape `&`, `<` and `>`. WebVTT shows the literal text, while some SRT players show `&lt;` instead. Use
  WebVTT in a browser when literal symbols matter.
- The video adds only the frames needed for each comment plus its tail, holding the last frame of the step. Actions
  that take longer than their comment continue normally.

## Verify a reel

```sh
npx flow-reel verify reels/out/settings.reel
```

This checks the reel against its manifest: every listed file is present with its size and hash, and nothing else is
there. It runs on the host without Docker.

| Exit | Meaning |
|---|---|
| 0 | The reel is whole. |
| 1 | A file is missing, extra or changed (each is named). |
| 2 | The folder isn't a reel, or its manifest is invalid. |

The manifest proves a reel is whole and unaltered. It doesn't prove two reels are the same, since the video's bytes
differ on every compose. That's what `compare` is for.

## Compare two reels

```sh
npx flow-reel compare reels/out/a.reel /tmp/a.reel
```

`compare` runs on the host without Docker or FFmpeg. It verifies both reels first, then checks that they match:

- video size and frame rate;
- the steps, in order, with exactly the same comments;
- the voice, and each clip's hash and duration;
- each step's start, within ±150 ms;
- the effects: the same `autoZoom`, and the same flashes, zooms, speed-ups, skips, cards and overlays in order, with
  equal options and image hashes, each starting within ±150 ms.

Clicks, moves, typing, scrolls and sounds aren't compared, and neither are pixels or the MP4's bytes. Script, image
and output paths may differ.

| Exit | Meaning |
|---|---|
| 0 | The reels match. |
| 1 | Both are valid, and they differ (the step or file is named). |
| 2 | Invalid input, failed sync or a usage error. |

# Reel format

The files of a reel, for tools that read them. Times are milliseconds on the video's timeline, and positions are CSS
pixels.

## `transcript.json` (version 2)

```json
{
  "version": 2,
  "script": "settings.reel.ts",
  "video": { "file": "video.mp4", "width": 1920, "height": 1080, "fps": 30, "durationMs": 14200 },
  "voice": { "adapter": "openai:gpt-4o-mini-tts", "voice": "coral", "seed": 0, "language": "auto" },
  "steps": [
    {
      "index": 0,
      "comment": "Open the settings page.",
      "startMs": 0,
      "actionEndMs": 1850,
      "endMs": 2900,
      "audio": { "file": "audio/000.wav", "durationMs": 2700, "sha256": "…" }
    }
  ]
}
```

| Field | |
|---|---|
| `steps[].comment` | the original comment, unnormalized. Absent for a step without one. |
| `steps[].startMs` | when the step starts |
| `steps[].actionEndMs` | when its last action returned |
| `steps[].endMs` | when it ends, after network quiet and the hold for its speech |
| `steps[].audio` | its speech clip, for a non-blank comment |
| `voice.adapter` | `qwen3-tts-0.6b` for the local voice, `<adapter>:<model>` for a cloud voice |
| `voice.voice` | the speaker |

The values above are illustrative.

## `events.json` (version 6)

```json
{ "version": 6, "autoZoom": true, "events": [ { "t": 1200, "type": "click", "at": { "x": 640, "y": 310 }, "button": "left", "target": "…" } ] }
```

| `type` | Fields |
|---|---|
| `move` | `from`, `to`, `durationMs`, `easing` |
| `click` | `at`, `button`, `target`, `bounds?` |
| `type` | `text`, `charDelayMs`, `target`, `bounds?` |
| `scroll` | `delta`, `durationMs` |
| `sound` | `name`, the constant's lowercase value |
| `flash` | `color`, `ms` |
| `zoom` | `zoom: "in"`, `at`, `bounds?`, `scale`, `ms`, or `zoom: "out"`, `ms` |
| `speed` | `factor`, `durationMs` |
| `skip` | `durationMs` (the length cut), `label`, `style` |
| `card` | `card`, `props`, `files` (path and SHA-256), `ms?`, `enter`, `exit`, `theme` |
| `overlay` | `overlay` (`callout`, `highlight`, `lowerThird`), `props`, `bounds?`, `ms`, `durationMs`, `theme` |

`bounds` is `{ x, y, width, height }`, taken before the action.

## `manifest.json` (version 1)

```json
{
  "version": 1,
  "script": { "file": "settings.reel.ts", "sha256": "…" },
  "composer": { "version": "0.5.0", "platform": "linux/amd64" },
  "integration": "playwright",
  "voice": { "adapter": "openai:gpt-4o-mini-tts", "voice": "coral", "seed": 0, "language": "auto" },
  "files": [ { "path": "video.mp4", "bytes": 3145728, "sha256": "…" } ]
}
```

Every file of the reel is listed with its size and SHA-256. `flow-reel verify` checks them.

## Media

| File | Format |
|---|---|
| `video.mp4` | H.264, 1920×1080, 30 fps. AAC-LC, 48 kHz stereo, 192 kb/s, normalized to -16 LUFS, -1.5 dBTP peak. No audio stream when there's neither speech nor sound. |
| `audio/NNN.wav` | 24 kHz mono 16-bit WAV, one per spoken step, named by step index. Skipped steps leave gaps in the numbers. |
| `captions.srt`, `captions.vtt` | One cue per commented step, from `startMs` to `endMs`. |

# Compile each script into a reel: one folder with a manifest

## Problem

One compose writes loose files next to the script (`x.mp4`, `x.transcript.json`, captions, `x.audio/`) plus working
files in `.flow-reel/`. Nothing lists what belongs together, so files get separated or mismatched.

## Change

The whole result of one compose is a **reel** (story decision 010, which replaces the word "cassette"): one folder
with fixed file names and a manifest.

```
settings.reel/
  manifest.json
  video.mp4
  transcript.json
  events.json
  captions.srt
  captions.vtt
  audio/000.wav …
  work/            intermediates: not in the manifest, ignored by git
```

- `flow-reel compose demos/settings.ts` writes `demos/settings.reel/`; `--out <dir>` writes `<dir>/settings.reel/`
  (decisions 001 and 002). `.flow-reel/` is no longer written.
- The manifest lists every file with its size and SHA-256, plus the script and its hash, the composer version and
  platform, the integration and the voice (decision 003). It proves a reel is whole, not that two reels are the same.
- A compose builds `settings.reel.partial/` and replaces the old reel only on success (decision 005).
- `flow-reel verify <reel>` checks a reel against its manifest; `flow-reel compare a.reel b.reel` verifies both,
  then compares their transcripts as today (decision 004).
- The composer writes the reel through the reel store port (was the cassette store).

## Out of scope

The reel cache (ticket 6), storage other than a local folder, cleaning up 0.1 outputs (the migration guide, ticket 7).

## Done when

- Composing a script produces one reel folder; nothing else is written beside the script.
- The manifest lists every file with a hash that matches; `flow-reel verify` exits 1 when a file is missing, extra or
  altered, and a test proves it.
- A failed compose leaves the previous reel unchanged.
- `flow-reel compare` accepts two reels and reports the same differences it reports today.
- `CONTEXT.md` and the README use "reel" and document the reel layout, `--out` and `verify`.

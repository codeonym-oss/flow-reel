# 002: Fixed file names in the reel; intermediates in its `work/` folder

**Superseded by GH-108 015** in part (2026-11-25): intermediates are in the run, outside the project; the reel has no `work/`.

**Date:** 2026-11-14 (ticket pass, Q3 and Q3b; agreed: "1 + nested structure for seperation the generated final
artifact and the mediary artifacts" and "ok")

**Supersedes 001** for where work files go: they move from `.flow-reel/<name>/` into the reel's `work/`. The rest of
001 stands.

**Question:** what are the files inside the reel called, and where do the intermediate files go?

**Decision:** **every reel has the same layout:**

```
settings.reel/
  manifest.json
  video.mp4
  transcript.json
  events.json
  captions.srt
  captions.vtt
  audio/000.wav …
  work/            capture.mp4, master.mp4, master.json, voice.wav, sfx.wav, mix.wav
```

The top level is the reel (story decision 004) and the manifest lists it. `work/` holds the intermediates: the
manifest leaves it out, and it ignores itself in git (`work/.gitignore` with `*`). Paths in the transcript are
relative to the reel: `video.file` is `video.mp4`, a clip is `audio/000.wav`. The composer no longer writes
`.flow-reel/`.

- **Why:** a program or an agent finds `transcript.json` without knowing the script's name; the reel is one folder
  per script, with what it delivers kept apart from what only helps debugging.
- **Not chosen:** names prefixed with the script inside the reel (repeated, and wrong after a rename);
  `out/` and `data/` subfolders as well (deeper paths, and the transcript would point across folders); keeping work
  files in `.flow-reel/` (two places per script).

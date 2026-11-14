# 003: The manifest proves a reel is whole, and says how it was composed

**Date:** 2026-11-14 (ticket pass, Q4; agreed: "ok")

**Question:** what does `manifest.json` hold?

**Decision:** **version 1:**

```json
{
  "version": 1,
  "script": { "file": "settings.ts", "sha256": "…" },
  "composer": { "version": "0.2.0", "platform": "linux/amd64" },
  "integration": "playwright",
  "voice": { "adapter": "qwen3-tts-0.6b", "voice": "Ryan", "seed": 0 },
  "files": [{ "path": "audio/000.wav", "bytes": 81964, "sha256": "…" }]
}
```

- `files` lists every file of the reel except `manifest.json` itself and `work/`, sorted by path, each with its
  size and SHA-256.
- `script` is the script's file name and the hash of its bytes, so a reel can be seen to be older than its script.
- `composer.version` is the package version; `platform` is the container's `linux/<arch>`.
- `integration` is the integration's name: the integration port gains a `name`.
- `voice` is the transcript's voice, left out when there is none.
- No timestamp.

The hashes prove a reel is whole and unaltered; they do not prove two reels are the same. `video.mp4` differs on
every compose, and voice clips differ between CPU architectures (GH-9 build notes). Sameness stays `flow-reel
compare`'s job (story decision 009 of GH-1, ±150 ms).

- **Why:** what the issue asked for, plus the two facts that explain differences between reels (an edited script,
  another architecture).
- **Not chosen:** files and hashes only (no record of how the reel was composed); a `composedAt` timestamp (two
  composes could never write the same manifest, and the file system keeps the date).

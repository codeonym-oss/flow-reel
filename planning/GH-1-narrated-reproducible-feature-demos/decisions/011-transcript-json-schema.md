# 011: `transcript.json` has one versioned schema; each ticket fills its own fields

**Date:** 2026-11-02 (global pass, Q9; agreed: "ok")

**Question:** what does `transcript.json` hold, given four tickets read or write it?

**Decision:** **this schema, version 1.** Times are milliseconds from the start of the video. Ticket 1 writes `video`
and each step's `index`, `startMs`, `actionEndMs` and `endMs` (equal to `actionEndMs` until the hold exists); ticket 2
adds `narration`; ticket 4 adds `voice`, each step's `audio` and the held `endMs`. Decision 009 compares two runs from
this file alone.

```json
{
  "version": 1,
  "script": "demo.ts",
  "video": { "file": "demo.mp4", "width": 1920, "height": 1080, "fps": 30, "durationMs": 14820 },
  "voice": { "adapter": "kokoro", "voice": "af_heart", "seed": 0 },
  "steps": [
    { "index": 0, "narration": "Open the settings page.",
      "startMs": 0, "actionEndMs": 820, "endMs": 2410,
      "audio": { "file": "audio/000.wav", "durationMs": 2310, "sha256": "…" } }
  ]
}
```

- **Why:** a fixed target each ticket is reviewed against; `sha256` makes "same audio clips" an equality check.
- **Not chosen:** timing-only now and fields added later (the format shifts mid-story); each ticket defining its
  part (no single target for decision 009).

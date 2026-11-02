# 013: The runner logs its own actions in a separate, versioned `events.json`

**Date:** 2026-11-02 (GH-2 ticket pass, Q3; agreed: "ok")

**Question:** what does the event log that the polish and SFX tickets read look like?

**Decision:** **`events.json`, version 1, written by the runner, listing what it did** — not sampled pointer
positions. Coordinates are CSS pixels on the 1920×1080 viewport; `t` is milliseconds on the same clock as
`transcript.json` (decision 011).

```json
{ "version": 1, "events": [
  { "t": 1200, "type": "move",  "from": [960, 540], "to": [1412, 288], "durationMs": 450, "easing": "easeInOutCubic" },
  { "t": 1650, "type": "click", "at": [1412, 288], "button": "left", "target": "link \"Settings\"" },
  { "t": 2400, "type": "type",  "text": "hello", "charDelayMs": 60, "target": "textbox \"Name\"" },
  { "t": 3100, "type": "scroll","delta": [0, 600], "durationMs": 400 }
]}
```

- **Why:** the runner moves the mouse itself, so its intent is the exact path; the log stays small and deterministic,
  and decision 009's comparison stays on `transcript.json`.
- **Not chosen:** per-frame pointer samples in `transcript.json` (thousands of entries, noisy comparison); leaving it
  to the polish ticket (GH-2 reworked later).

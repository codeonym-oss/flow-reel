# 004: TTS sits behind an adapter, with a local open voice by default

**Partly superseded by GH-4 decision 002** (the starting local model is Qwen3-TTS 0.6B instead of Kokoro/Piper).

**Date:** 2026-11-02 (shaping, Q4; agreed: "yes!")

**Question:** local TTS, cloud TTS, or pluggable?

**Decision:** **pluggable, local by default.** The image ships a local open model (Kokoro or Piper, CPU) so it works
offline and in CI with no API key; adapters let ElevenLabs, OpenAI and others be used with a key.

- **Why:** the local default keeps decision 003's "same script, same video" true; paid voices stay available for
  client-facing demos.
- **Not chosen:** local only (no premium voices); cloud only (keys, network, cost, not reproducible).

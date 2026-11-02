# 004: TTS sits behind an adapter, with a local open voice by default

**Date:** 2026-11-02 (shaping, Q4; agreed: "yes!")

**Question:** local TTS, cloud TTS, or pluggable?

**Decision:** **pluggable, local by default.** The image ships a local open model (Kokoro or Piper, CPU) so it works
offline and in CI with no API key; adapters let ElevenLabs, OpenAI and others be used with a key.

- **Why:** the local default keeps decision 003's "same script, same video" true; paid voices stay available for
  client-facing demos.
- **Not chosen:** local only (no premium voices); cloud only (keys, network, cost, not reproducible).

# 004: Every response becomes 24 kHz mono 16-bit WAV, and the model is part of the cache key

**Date:** 2026-11-15 (agent's call)

**Decision:** each provider is asked for raw PCM or WAV, and ffmpeg (already in the image) converts the answer to 24
kHz mono 16-bit WAV, which `voiceSteps` measures as it does the local voice's clips. The transcript's `voice.adapter`
is `<adapter>:<model>`, so changing the model voices everything again; the seed is 0. Requests go four at a time;
429s, 5xx and dropped connections are retried with backoff (honouring `Retry-After` up to 30 s); other errors fail at
once with the status and the provider's message, and name the key's variable on a 401 or 403.

- **Why:** no change to the transcript schema, the voicing step or the mix; the reel cache keeps a recompose from
  re-billing unchanged comments, and from changing their audio.
- **Not chosen:** a `model` field in the transcript (a schema version for a value that fits in `adapter`).

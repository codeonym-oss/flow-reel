# 003: A cloud voice's model, speaker and language are passed on unchecked

**Date:** 2026-11-15 (agent's call)

**Decision:** `voice` gains `model`, `apiKeyEnv` and `baseUrl` (flags `--model`, `--api-key-env`, `--base-url`), for
cloud voices only: the local voice refuses them. A cloud voice's speaker and model can be any string; its language
defaults to `auto` (the provider detects it), and is sent only to Together AI and ElevenLabs, which take an ISO
639-1 code.

- **Why:** providers add and retire models and voices often; a copied list would be wrong within months, and the
  provider's own error names the problem.
- **Not chosen:** listing each provider's voices (stale); mapping `english` to `en` (two vocabularies for one setting).

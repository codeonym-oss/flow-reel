# 002: Seven cloud voices, and Claude isn't one

**Date:** 2026-11-15 (agent's call; asked for "openai, gemini, claude, openrouter, togetherai and others")

**Decision:** `openai`, `gemini`, `openrouter`, `together`, `groq`, `elevenlabs`, and `openai-compatible` (any server
implementing OpenAI's `/audio/speech`: its `baseUrl` and `model` are required, its key optional). Each has a default
model, speaker, key variable and server; `baseUrl` overrides the server for any of them.

- **Why:** these cover the hosted speech APIs in use; OpenRouter routes to many more models behind one key, and
  `openai-compatible` covers self-hosted servers and providers that copy OpenAI's API.
- **Claude:** Anthropic has no speech API, so there's nothing to call.
- **Not chosen:** a provider SDK each (seven dependencies for one HTTP request each).

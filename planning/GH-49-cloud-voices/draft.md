# GH-49: Speak comments with a cloud voice

**Why:** the local voice (Qwen3-TTS 0.6B on the CPU) is slow on long scripts. A cloud voice speaks the same comments
in seconds. The local voice stays, and stays the default.

**What:** `voice.adapter` can name a cloud provider. `flow-reel.json` and flags choose its model and speaker, and
name the environment variable that holds its API key. Only the composer and its settings change: scripts, the reel's
files and the plugin's words don't.

**Done when**
- Providers: OpenAI, Gemini, OpenRouter, Together AI, Groq, ElevenLabs, and any OpenAI-compatible server.
- The key stays in the environment; it's never in `flow-reel.json`, the reel, the manifest or a command line.
- Each clip is the mono 16-bit WAV the composer already measures; the reel cache reuses unchanged comments.
- Tests: each provider's request against a local fake server; a compose in the image against a fake provider.
- The README says how to configure each provider.

**Not in this ticket:** a slimmer image without the local model; delivery instructions (tone prompts); the plugin's
references (a plugin-only pull request after the runtime release).

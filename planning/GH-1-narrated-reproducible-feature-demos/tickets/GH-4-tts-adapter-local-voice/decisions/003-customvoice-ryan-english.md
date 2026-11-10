# 003: Use CustomVoice with Ryan in English

**Date:** 2026-11-10 (ticket pass, Q3; agreed: "ok")

**Question:** start with a built-in voice or the Base model's voice cloning?

**Decision:** **bundle `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`, with Ryan and English as the initial voice and
language.** Voice cloning, reference-audio configuration and voice design are outside GH-4.

- **Why:** a built-in English speaker gives narration without another user-supplied asset.
- **Not chosen:** Base with voice cloning, which adds reference-audio configuration and testing.

Source: [official CustomVoice model card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice), checked
2026-11-10; Ryan is listed as a native English speaker.

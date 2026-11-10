# 005: Use the official Python runtime on CPU

**Date:** 2026-11-10 (ticket pass, Q5; agreed: "ok")

**Question:** use the official Python runtime or an optimized community runtime?

**Decision:** **use the official `qwen-tts` Python runtime on CPU**, called through the inherited subprocess
boundary. Pin its dependencies and the model/tokenizer asset revisions; bundle the required assets in the image,
with no runtime downloads. No GPU requirement or alternative community runtime is introduced.

- **Why:** fewer compatibility assumptions while integrating the selected Qwen checkpoint.
- **Not chosen:** a community runtime with extra compatibility and conversion work.
- **Build checks:** synthesize representative narration twice in fresh processes with networking disabled; compare
  complete WAV SHA-256 hashes. Pin generation settings and reset seed 0 per clip. Check the talker and sub-talker
  settings explicitly rather than relying on upstream sampling defaults. Record wall time and peak memory. If
  repeatability or practical CPU operation fails, report the evidence and revisit the choice before proceeding.
- **Limit:** equal hashes must be demonstrated on the tested CPU/container platform; cross-architecture equality
  is not established by that test and must not be claimed.

Sources checked 2026-11-10:
- [Official runtime and setup](https://github.com/QwenLM/Qwen3-TTS).
- [Generation wrapper](https://github.com/QwenLM/Qwen3-TTS/blob/main/qwen_tts/inference/qwen3_tts_model.py):
  generation parameters include both talker and sub-talker sampling settings.

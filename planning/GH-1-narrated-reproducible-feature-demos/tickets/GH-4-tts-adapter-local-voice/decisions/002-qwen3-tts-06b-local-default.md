# 002: Start with Qwen3-TTS 0.6B as the local engine

**Date:** 2026-11-10 (ticket pass, Q2; agreed: "lets choose qwen i guess? right wqen 0.6 as starter !")

**Question:** which local TTS engine ships first?

**Decision:** **Qwen3-TTS 0.6B** is the starting local engine, replacing the Kokoro/Piper candidates in story
decision 004. Local, offline, CPU execution remains required. The exact variant, default speaker and runtime are
settled separately. No Kokoro or Piper fallback is added in this ticket.

- **Why:** the person chose Qwen 0.6B as the starting engine.
- **Not chosen:** Kokoro or Piper as the initial bundled engine.
- **Verification required:** pin runtime and model assets; prove network-disabled synthesis and matching WAV
  SHA-256 hashes across fresh runs. Measure CPU time and peak memory rather than assuming the GPU-oriented
  upstream examples establish CPU performance. A failed requirement must be surfaced before changing the engine
  or the reproducibility contract.

Sources checked on 2026-11-10:
- [Official model list and Python runtime](https://github.com/QwenLM/Qwen3-TTS): 0.6B CustomVoice and Base variants.
- [CustomVoice model card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice): Apache-2.0 weights,
  built-in speakers and supported languages; examples use CUDA.

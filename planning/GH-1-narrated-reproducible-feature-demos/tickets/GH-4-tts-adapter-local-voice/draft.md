# Voice narration through a TTS adapter with a local default voice

## Problem

GH-3 preserves narration and writes captions, but produces no speech. Narration needs a local, keyless voice that
works offline in the recording image, with repeatable audio for later sync and comparison work.

## Change

- Add a small internal TTS adapter boundary: text in, WAV clips and measured durations and SHA-256 hashes out.
- Bundle `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`, using Ryan in English, with the official Python `qwen-tts`
  runtime on CPU. Pin dependencies and model/tokenizer assets; no runtime downloads (ticket decisions 002-005).
- `flow-reel record demo.ts` synthesizes narration after capture, writes `demo.audio/NNN.wav`, and adds `voice`
  and step `audio` metadata to schema version 1. Paths are relative to the transcript directory; filenames use
  zero-based step indexes padded to at least three digits (ticket decisions 001, 006, 007).
- Preserve original narration. Normalize whitespace only for synthesis, without caption entity escaping.
  Missing or blank narration has no clip or `audio` field; nonblank narration is voiced even for a zero-duration
  action (ticket decision 006).
- Record the adapter, voice and seed; reset seed 0 per clip and pin generation settings. Verify complete WAV
  hashes across fresh processes on the tested CPU/container platform.
- Synthesis failure fails the command with context. The MP4 stays silent and step/caption timing stays as
  recorded; GH-5 adds holds and muxing.

Ticket decision 001 supersedes story decision 011 only in assigning voice/audio metadata to GH-4 rather than
GH-5. The schema itself is unchanged. Decisions 002-003 select Qwen instead of the story's Kokoro/Piper candidates.

## Out of scope

- Step holds, audio muxing, sync checks and a transcript-comparison command (GH-5).
- Cloud providers, credentials and secret forwarding; those would be separately planned work (decision 004).
- Voice cloning, reference recordings, voice design, voice/language configuration flags.
- GPU execution, community inference runtimes, cross-architecture byte-equality claims, cursor/zoom polish and SFX.

## Done when

- Recording produces valid voice/audio metadata and playable nonempty WAVs for nonblank narration. Referenced
  files exist; durations and complete-file SHA-256 hashes match the actual WAVs.
- Fresh synthesis processes with networking disabled produce matching hashes for the same normalized text and
  settings on the tested CPU/container platform. The test regenerates clips rather than reusing cached audio.
- Blank narration is skipped, step indexes remain stable, and original transcript text stays intact. Rerunning
  with fewer voiced steps leaves no stale generated clips, while preserving unrelated files and other demos.
- Missing assets or a worker failure produce a nonzero command result, with no new transcript claiming successful
  synthesis. The MP4 stays silent; caption/step timing and existing schema compatibility remain intact.
- CPU wall time, peak memory, image size and tested platform are reported; sample narration is inspected for
  intelligibility. If CPU operation or repeatability fails, surface evidence before changing engine or contract.
- Type checking, unit tests, build and Docker E2E pass, including existing resolution, frame-alignment, caption
  playback and ±150 ms step-start checks. README describes clips and the still-silent MP4 accurately.

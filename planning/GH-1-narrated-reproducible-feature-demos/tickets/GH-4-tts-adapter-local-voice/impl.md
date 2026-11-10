# Implementation: Local Qwen narration clips

Planned 2026-11-10 against `main` at `487d62b`, after GH-3 merged in PR #11. Follow story decisions 004, 008-011
and ticket decisions 001-007. No existing follow-ups are taken up. GH-5 owns holds and muxing.

## Build notes (2026-11-10)

- Implemented the official Qwen 0.6B CustomVoice CPU worker (Ryan/English) and internal TypeScript adapter.
  Synthesis starts after capture, browser and display shutdown. WAVs are staged, validated and published to
  the demo-specific audio folder before the transcript is written. No step timing, holds or muxing were added.
- Observed red/green slices for missing synthesis, blank-input worker avoidance, stale clips and invalid audio.
  The recording integration test failed on absent voice metadata before integration. All 50 unit tests pass.
- Verified final `npm run typecheck`, `npm test` (50 passed), `npm run build`, and a clean
  `npm run test:e2e` (10 passed across 2 files, 968.05 seconds). `git diff --check` passes.
  The full E2E command's build and real Docker runs completed successfully; no tests were skipped in that run.
- The final recording pair has identical audio metadata and complete WAV hashes; step start deltas are
  2, 2 and 3 ms. Existing frame alignment, resolution and native caption playback assertions pass. Both direct
  worker and command-level missing-asset failures are checked, including absence of a success transcript.
- Real network-disabled workers regenerate the same WAV bytes in fresh processes. Repeated text at different
  indexes also matches, proving per-clip seed reset. The person listened to the sample and answered "Sounds good".
- Image size is about 7.0 GB unpacked. The model asset download/verification step took 377.9 seconds locally.
  CPU-wheel index resolution initially failed; requirements now pin official CPU wheel URLs/checksums, plus
  version-pinned runtime dependencies. Model/tokenizer revisions and published asset hashes are in assets.json.
  Only x86_64 is tested; aarch64 wheel URLs are specified, without claiming cross-architecture equality.
- Final recording synthesis batches took 195.525 and 206.414 seconds; final offline batches took 261.525 and
  185.745 seconds. Peak process memory across measured runs reached about 5.6 GiB. README reports a representative
  earlier 147-second run and explicitly notes host-load variation. CI timeout is 45 minutes to accommodate
  cold image building and CPU synthesis; all checks remain enabled.
- Generation is bounded to 1,024 codec tokens. The pinned wrapper discards codec counts, so its generation
  boundary is checked for limit exhaustion before WAV acceptance. The Node worker job timeout is 15 minutes.
- Initial capture attempts hit the existing overload guard; it was not weakened. The CLI error-path test uses a
  960×540 viewport (1280×720 master), with full-resolution success fixtures preserved. A temporary 640×360 fixture
  exposed the pre-existing odd-width/early-encoder-exit hang. The approved GH-2 follow-up records it separately.
  A timed-out test container was removed, and the error-path test now names and force-cleans its own container
  in a finally block with a child deadline shorter than the test deadline. No test containers remain running.
- E2E files run serially and use separate output folders under test/e2e/out. Per-test cleanup preserves other
  artifacts on focused reruns. npm pack dry-run includes the compiled adapter, worker, requirements and asset
  specifications, without model weights (about 23 KB packed).
- Parallel Standards and Spec reviews against 487d62b, including all new files and final incremental changes,
  found zero issues on both axes. No agreed feature was changed or left unimplemented. PR #12 merged as `2e1e32d` after final-head CI passed.

## Current code and baseline

- `src/runner/run.ts` preserves narration, calibrates step/event times, writes a silent MP4, validates the
  transcript and writes SRT/VTT. No TTS code or Python environment exists in the image.
- `src/schema/transcript.ts` already defines optional `voice: { adapter, voice, seed }` and step
  `audio: { file, durationMs, sha256 }`. Keep version 1 and acceptance of old transcripts.
- `src/index.ts` exposes URL/viewport options and `step(narration, action)`. No public TTS configuration is needed
  for this ticket's fixed default. The host launcher mounts the script folder and runs the versioned image.
- `docker/Dockerfile` extends Playwright Noble, installs Xvfb/ffmpeg and copies `dist`. npm publishes `dist` and
  `docker`; put Python helpers and their pinned build specifications under `docker/` so fallback builds include them.
- Baseline: type checking and all 45 unit tests passed. The sandbox loader subprocess failed with empty stderr;
  all tests passed outside the sandbox. Docker E2E was not rerun for planning; PR #11 CI passed.

## Read first

- This ticket's decisions 001-007 and inherited story decisions 004, 008, 009, 010 and 011.
- `src/runner/run.ts`, `src/schema/transcript.ts`, `src/schema/check.ts`, `src/runner/captions.ts`.
- `src/index.ts`, `src/cli.ts`, `src/host/launch.ts`, `src/runner/recorder.ts` (`durationMs`).
- `docker/Dockerfile`, `package.json`, `tsconfig.build.json`, `.github/workflows/ci.yml`, `README.md`.
- `test/unit/schema.test.ts`, `test/unit/captions.test.ts`, `test/e2e/record.test.ts`, `test/e2e/player.ts`.
- [Official runtime](https://github.com/QwenLM/Qwen3-TTS), especially its inference generation wrapper, and
  [selected checkpoint](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice). Read pinned-revision code;
  GPU-oriented upstream examples do not establish CPU performance.

## Steps

1. **Prove the real CPU/offline path first.** Add a small Python worker under `docker/tts/`. Install the official
   package in an isolated environment, pin compatible CPU PyTorch/dependency versions, and pin immutable model
   and tokenizer revisions with verified asset hashes. Fetch all required assets at image build time, keeping
   applicable licences/notices. Load explicit local paths with runtime networking disabled. Use CPU float32 and
   a CPU-compatible attention implementation; no CUDA or FlashAttention installation.
   Load the model once per worker invocation, process clips serially and write mono PCM16 WAVs at its returned
   sample rate. Reset Python/NumPy/PyTorch seeds to 0 per clip, enable deterministic execution, and explicitly pin
   talker and sub-talker generation settings. Start with upstream sampling settings plus the reset seed and prove
   equality. Bound generation; detect empty output or token-limit truncation rather than claiming success.
   Pass indexed texts and destinations as structured JSON over stdin; stdout carries machine-readable results
   and stderr carries diagnostics. Never interpolate narration into shell commands.
   → check: add a real Docker synthesis test running the worker in two fresh `--network none` containers with
   separate empty output folders and no audio reuse. Assert playable, nonempty WAVs and equal complete-file hashes
   for representative lines, including repeated text at different indexes to test seed reset. Measure wall time,
   peak memory and image size. Inspect/listen to a generated sample. If CPU operation, quality or repeatability
   fails, report evidence before substituting the runtime/model or weakening requirements.

2. **Add the narrow TypeScript adapter and clip orchestration.** Create `src/runner/tts.ts` with an internal
   adapter interface holding fixed `{ adapter, voice, seed }` identity and an asynchronous synthesis operation
   for indexed text requests and destinations. Implement only Qwen via `spawn` with argument arrays. Keep one
   multi-clip worker call so the model loads once; no registry, public plugin API, cloud secrets or CLI flags.
   Normalize whitespace runs to one space and trim synthesis input, skip missing/blank text and preserve original
   steps. Use original indexes with `padStart(3, "0")`. Compute SHA-256 from complete WAVs in Node; measure duration
   from actual sample data or checked ffprobe output, rejecting missing/invalid/empty audio. Return metadata only
   after successful validation. Keep worker invocation behind the adapter seam so orchestration tests can use a
   small fake without presenting fake output as proof of real Qwen reproducibility.
   → check: write failing `test/unit/tts.test.ts` tests, then implement. Cover blank/missing narration, whitespace,
   Unicode, literal markup/entity-looking text without caption escaping, nonblank zero-duration steps, gaps,
   indexes above 999, duration/hash correctness, paths with spaces, nonmutation and contextual worker failures.

3. **Integrate after capture and before publishing the transcript.** Call synthesis from `src/runner/run.ts`
   after capture stops and final times are calibrated. Close browser/display before expensive synthesis where
   practical without altering capture timing. Write `<name>.audio/NNN.wav` beside the transcript and attach
   relative paths such as `demo.audio/000.wav` and measured metadata. Write the fixed voice identity in version 1.
   Keep timing, `endMs`, captions and the silent video unchanged. For an all-blank demo, skip launching the worker,
   retain configured voice identity and omit step audio.
   Replace this demo's generated numeric WAV set on success so fewer voiced steps leave no stale generated clips.
   Scope replacement to flow-reel's numeric WAVs in this demo-specific folder; preserve unrelated files and other
   demos. Stage outputs if needed to avoid publishing a partial clip set. Failure must fail the command and must
   not publish a new transcript claiming complete successful synthesis.
   → check: test reruns with fewer voiced steps and all-blank narration at the orchestration seam; preserve other
   files and demos. Exercise worker failure/missing assets and useful nonzero errors. Extend E2E to verify every
   referenced WAV, PCM encoding, positive duration, actual duration/hash and transcript-relative resolution.
   Existing old-schema acceptance must stay green.

4. **Verify recordings and document output.** Extend the existing two fixture recordings in
   `test/e2e/record.test.ts`: compare voice identity, clip hashes and durations across runs, while retaining original
   narration and all resolution, frame-alignment, caption playback and ±150 ms checks. The separate synthesis
   test disables networking; browser recording still needs the host fixture server. Exercise the shipped worker,
   not a test-only replacement.
   Update README with Qwen/Ryan/English, measured CPU/disk needs, build-time downloads versus offline synthesis,
   `demo.audio/` paths, skipped blanks, reproducibility limits and the still-silent MP4. Audio may exceed action
   windows until GH-5 adds holds and muxing. Change CI only if measured resource/time requirements require it;
   keep actual CPU/offline synthesis in CI rather than replacing it with fakes.
   → check: run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Check output references against
   README. Run `npm pack --dry-run` to verify helper and build specifications ship, without model weights in npm.
   Record results and measurements as build notes in this plan.

## Tests

- Unit: normalization/eligibility, stable indexes, relative paths, metadata, nonmutation, scoped replacement and
  failures at the adapter seam; existing schema compatibility.
- Real Docker synthesis: two fresh offline processes, regenerated WAVs, complete-file equality, seed reset,
  actual audio validity and CPU resource measurements. No speed or memory claims before measurement.
- Existing recording E2E: both runs acquire audio clips and metadata while all GH-2/GH-3 guarantees remain.
- Sample listening: intelligibility and obvious truncation/repetition. If listening is unavailable, report that
  limitation and request human review of a concrete generated sample; parsing WAVs is not a listening check.

## Risks

- Qwen's model and Python dependencies increase image size and may exceed current CI CPU/memory/time budgets.
  Measure first; surface failures before changing engine, requiring a GPU or dropping checks.
- Seed alone is not proof of determinism. Pin settings/assets, reset per clip and test fresh processes. Equality
  across CPU architectures is unproven; GH-9 must validate its release architectures separately.
- Empty, truncated or runaway speech must fail with step context rather than be accepted as a valid clip.
- TTS during real-time capture could break timing: synthesize only after capture stops.
- Relative paths must work with spaces and adjacent demos. Cleanup must preserve unrelated files. Original
  narration and caption escaping stay intact.
- Clip durations intentionally do not fit step windows yet. GH-5 owns that work; do not move timestamps to hide it.

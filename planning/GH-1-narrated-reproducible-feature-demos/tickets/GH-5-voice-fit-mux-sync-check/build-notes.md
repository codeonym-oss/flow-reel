# GH-5 build notes

Base: main at 76a31531ae34cec8ae238c1188016423579ee025. Branch: feat/5-voice-fit-mux-sync-check.

## Implemented

Single capture with bounded post-action network quiet plus 100 ms; pure integer-frame hold planning and one
final event mapping; assembled/normalized delivery voice; retimed master preserving calibration pre-roll;
shared semantic sync checks; host-only transcript comparison with 0/1/2 exit statuses; README contract.
The original Qwen settings, public WAVs/hashes, overload guard and unrelated follow-ups are unchanged.

## Verification so far

- `npm test`: 63 tests pass; `npm run typecheck` and `npm run build` pass.
- Focused real-browser settling fixture: old code failed with 0 ms between callback return and visual endpoint;
  updated code captures the delayed response and passes. Initial overloaded-host run failed the existing guard
  (24% shortfall); user freed CPU and it reached the intended assertion. Guard/tolerances were retained.
- Synthetic media tests: exact source/master/delivery frame counts, red-frame holds before a blue transition,
  final hold, pre-roll preservation, blank-only output, stream codec/rate/channels, raw WAV hashes unchanged,
  decoded clip starts/ends within one frame, delivered loudness/peak measurement, and invalid-media/silence errors.
  All seven checks, including review regressions and combined holds/audio placement, pass on both host FFmpeg
  and the recording image's FFmpeg.
- Built host comparison runs with PATH containing no external executables and FLOW_REEL_IN_CONTAINER=1: equal,
  different, invalid JSON, failed sync, missing file and usage cases pass (0/1/2 statuses).
- `npm pack --dry-run --json`: includes dist/compare.js, dist/schema/sync.js, dist/runner/timeline.js and
  dist/runner/render.js. The installed npm outputs a package-name-keyed object; its files were checked directly.
- Corrected real-speech preview (`test/e2e/out/preview/demo.mp4`): video and 48 kHz stereo AAC both 12.500 s;
  decoded -16.40 LUFS / -2.00 dBTP. Rendered from the first run's held master and unchanged source WAVs without
  another action replay or TTS call. Person approved playback: "Playback sounds good" (all three lines, screen holds and pauses).
- Offline TTS fresh processes: 140.835 s / 5,677,132 KiB and 120.254 s / 5,789,436 KiB. First recording synthesis:
  181.003 s / 5,791,216 KiB. Full serial Docker suite and final fixed-image recording pair remain pending.

## Review and corrections

Standards review found an orphaned validation branch after validation moved before publication; replaced it with
writeJson. Both reviewers found stale voice intermediates on blank reruns; renderer removes only its owned
voice.wav and voice.wav.bus.wav when clips are absent. Regression fails before the change and passes afterward.

Spec review found that loudnorm can switch to dynamic normalization at 192 kHz. Sample-based padding/trimming now
explicitly resamples to 48 kHz first. A regression with extreme transients verifies the full 5.5-second bus and
its late clip survive. Its delivered level is about -20 LUFS, so the command correctly rejects it under the
unchanged loudness target; this fixture tests failure and duration retention, not a relaxed normalization target.

Frame-derived times can contain fractional milliseconds; caption serialization rounds them to valid whole-ms
SRT/WebVTT timestamps, covered across a second boundary. No design decisions were changed.

The first full-suite image was built before review corrections. Its first real demo exposed the dynamic-mode
bug directly: 12.500 s video but only 3.125 s audio, despite valid transcript durations and acceptable loudness.
The renderer now also checks normalized-bus duration to one sample and AAC stream duration to one frame against
the planned timeline. The recording E2E asserts actual audio duration, in addition to schema and fit checks.
The final full suite is running with rebuilt fixed image 44fb4f54671da97b433f457bab9ad1cdf24299d982351803a89077223bf03c98; early-image success is not final evidence.

Final-source checks: `npm test` passes all 63 tests (12 files, 1.82 s); `npm run typecheck` and build pass.
Final `npm pack --dry-run --json`: 48 files, 28,265 bytes, all new compiled modules included.
First full media pass: 19 tests passed in 821.81 s. A fresh final full media pass is running after the normalization
fix; the earlier run's audio-duration defect is documented above rather than counted as final delivery evidence.
Review rechecks: Standards 0 unresolved; Spec 0 unresolved (2 corrected defects). Human playback approved.

Final full-suite run with the fixed image: 12 passed / 7 skipped in 991.33 s. The shared recording hook failed
on **recording b's capture overload guard**: 6,933 ms video for 12,014 ms wall time (42% shortfall). Host load
reached about 29 on eight CPUs. The first recording succeeded; the initial suspicion of a render failure was
corrected once the suite printed its shared-hook error. No source changes were made for this resource failure.
The image's renderer was independently exercised against the completed master/WAVs and passed at -16.43 LUFS /
-1.99 dBTP. The normalized bus and AAC have full planned duration. Asked the person to free CPU before rerunning
the recording pair; the full suite's offline TTS, renderer and CLI checks already passed on the fixed source.

## Final result

After the person freed CPU again, the unchanged recording file was rerun:
`node_modules/.bin/vitest run test/e2e/record.test.ts --hookTimeout=900000 --testTimeout=900000`:
**9 passed in 488.01 s**. Together with the fixed-image full run's other passing files (offline TTS 2, renderer 7,
CLI 1), **all 19 unique media checks pass**. The earlier full command's resource failure remains documented above;
it was not hidden or fixed by weakening a guard. No source/test changes occurred between that full run and retry.

- Both final demos have full AAC duration, fitted steps, unchanged source WAV hashes and valid native captions.
- Host `node dist/cli.js compare .../a/demo.transcript.json .../b/demo.transcript.json`: exit 0, transcripts match.
- Step start differences: 5 ms, 40.333 ms, 9 ms (maximum 40.333 ms < 150 ms).
- Clip tails, run a: 203.667 / 208.333 / 242.667 ms; run b: 232 / 201.333 / 233.667 ms (all >= 200 ms).
- First final demo: -16.42 LUFS / -1.98 dBTP. Magenta click discrepancy:
  -12.493 ms (limit ±66.667 ms / two frames). Retimed master and delivery frame checks pass.
- Final TTS synthesis: a 198.801 s / 5,783,284 KiB; b 180.446 s / 5,694,716 KiB peak process memory.
- Person approved the corrected narrated MP4: "Playback sounds good". Same voice/source clips in final pair.
- Final unit/type/build/package/whitespace checks and both review axes passed as recorded above.

No implementation steps left undone. Small implementation notes (fractional caption timestamps, explicit AAC peak
margin, normalization resampling/duration guards and clearing stale buses) retain the approved design. The
odd-viewport encoder and optional 4K follow-ups remain open and untouched. Ready for commit approval.

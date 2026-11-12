# GH-8 build notes

- Starting at main `a811559`; 73 unit tests and typecheck passed during planning.
- Test seams were listed in impl.md and approved with the shared scope and implementation authorization.
- TDD: cue-logging module missing → typed/runtime validated cue logs pass; camera adjacency regression failed with interleaved cue → filtering audio-only events passes; planner missing → Unicode and placement cases pass; SFX assembler missing → decoded timing/quiet/repeatability passes; CLI/muting tests failed → parsing and forwarding pass. First integration: 80 unit tests and 10 focused render/SFX media tests pass on host FFmpeg.
- First complete suite: 18 passed, 8 skipped, recording pair blocked by 14% capture shortfall. Visual raw-frame extraction also overflowed its buffer because new audio caused FFmpeg to duplicate selected frames; explicitly disabled audio and selected passthrough FPS in those visual assertions. Old stereo-to-mono test decoding added 3 dB; fixed per-channel assertions and explicit normalized production channel averaging.
- Second capture retry after CPU-free answer: 9% behind; guard unchanged. Muted all-eight-cue recorder test passed. Repeated offline TTS checks passed; host media during palette edits saw stale cached module/asset paths, so these runs do not qualify as final media verification. Final focused runs and final-image package check will use stable sources.
- Standards rereview: no remaining violations/smells. Spec rereview: no confirmed functional blocker; added long typing/dense cues/duck overlap tests, voice-only isolation and real muted cue recording. Added independent calibration RMS assertions (red at old levels) and stricter finite-or-negative-infinity peak measurement for quiet SFX-only delivery.
- Initial preview human feedback: functional but too low/generic; not aesthetically approved. Revised DAEDAL palette and +6 dB calibration per decision 008, second preview pending.
- Human approved the revised preview: “Yes — this sound selection and mix feel good.” `test/e2e/out/gh8-preview-v2/with-sfx/demo.mp4` keeps 375 frames; measured -16.54 LUFS / -2.01 dBTP on host FFmpeg. All eight cues plus typing are in the companion palette WAV.
- Final source-focused checks: 80/80 unit tests, typecheck/build, and 17/17 focused render/polish/SFX/compare media tests pass. Calibration includes known-sine narration, ducked cue/typing RMS, silence-padding invariance, 32-second typing/dense-overlap case, exact tail fade and quiet SFX-only edge case.
- Final Standards review: 0 hard violations / 0 smells. Final Spec review: 0 functional findings; pending final full-suite/package verification only.

## Final verification (2026-11-12)

- Final complete `npm run test:e2e`: **30/30**, 6 files, 796.72 seconds. Includes successful real narrated pair, source speech hashes and ±150 ms transcript compare, all-eight-cue muted recorder, browser caption playback, offline fresh-process Qwen repeatability, clean master/polish, render and SFX cases. Earlier overload failures did not require relaxed guards or timing tolerance.
- Recording image: `sha256:7d50e61bcbe13b7eae4c97eb7bef584321d3f1d5d1261cfa5fc55a66415cc4c2`.
- Final npm package: 71 files / 728,974 compressed bytes, including 12 derived WAV assets, licence and provenance. Original archive hash, all source-file hashes, all derived-file hashes and packed-file hashes agree. Planning/audition library excluded from the package.
- Packed-package smoke with image FFmpeg and `--network none`: all eight cues and typing render; exact 90-frame output; muting works with an asset deliberately hidden; unmuted missing asset fails clearly; asset restored. This smoke uses the extracted package rather than source modules/node_modules.
- Actual 12.5-second narrated render in final image, without browser replay/TTS: **22.34 s wall, 818,264 KiB peak RSS (~799 MiB), no swap**; preserved 375 frames, measured **-16.56 LUFS / -2.08 dBTP**. Outputs at `test/e2e/out/gh8-perf/`.
- GitHub issue body synchronized with the approved DAEDAL refinement.
- Repeated the same real voiced render in the final image: decoded final-audio hashes match exactly (`SHA256=414b22efc8605f2c093a0c6589dc3385357e9e2fae4880965d31668372089041`). No browser replay or new synthesis.
- Staged diff check passes after normalizing CRLF/trailing whitespace in the two newly imported Kenney licence text copies; licence wording and original audio bytes are unchanged.
- Implementation plan complete; no unverified required local checks remain. Playback approved; both review axes clear. Changes staged for commit review, not committed or pushed.
- Published implementation commit `2a6e39a` as PR https://github.com/codeonym-oss/flow-reel/pull/15 under user approval. Planning status in-review; project board has only Todo/In Progress/Done, so In Progress remains during review.

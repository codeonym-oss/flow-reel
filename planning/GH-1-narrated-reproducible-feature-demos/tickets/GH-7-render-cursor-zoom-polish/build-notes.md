# GH-7 implementation evidence

Baseline: main a36dc26. Approved branch and source implementation: "approve ! start building !".
Confirmed test seams from impl.md: event schema/wrapped actions, pure camera planner, decoded FFmpeg output,
and the existing end-to-end record pair. Using the TDD and code-review skills required by implement.

## Red/green and focused checks

- Event metadata: wrapper exact-event and schema-invalid-bounds tests failed before bounds were added; 19 focused tests then passed. Bounds reuse pre-action approach reads; existing pacing tests pass.
- Pure planner: absent module failed first, then the basic 300/1000/400 ms case passed. Activity-extension case failed before merged scheduling. Added worked path, frame-quantization, target-fit, no-trigger and old-log cases.
- Decoded cursor test failed on the original plain renderer. Cursor, grid/zoom/ripple, decoded-repeatability and 31-click long fixture now pass on the host. Long fixture includes simultaneous clicks.
- Seven existing renderer tests and two initial polish tests passed on FFmpeg 9 (host) and FFmpeg 6 (image). Added click activity to the held-audio test to retain decoded tone-placement/tail coverage with overlays.
- Standards review: no hard violations; removed duplicate event validation. Spec review: fast pointer could escape during ease-out (x=1949.92 on 1920px output); reproduced in a failing test and fixed with shared effective-crop constraints. Recheck pending.
- Full serial E2E started after build, including updated image, recording pair, offline TTS, compare and synthetic media.

## Review recheck

- Standards: 0 hard violations; duplicate event validation removed.
- Spec: initial hotspot-only correction still clipped the arrow. Added delivery-space 24px right/bottom and 1px left/top sprite margins, constrained by physical source edges. Strengthened the unit regression (frame 38 <=1896px) and added a decoded 1080p test counting visible arrow pixels in frames 37–39.
- Spec reviewer rechecked crop/FFmpeg parity and continuity: no remaining blockers.
- Package dry run: 52 files, about 33.2kB, including both new compiled modules and declarations. No dependencies or Docker/CI settings changed. npm cache access required an outside-sandbox rerun.
- The full E2E image was built before the final sprite-margin correction. After it completes, rerun focused media in the updated image and verify a final built-package render; do not claim the earlier image alone verifies that correction.

- Final unit baseline after wrapper/navigation and bounds-retiming assertions: 72 tests in 13 files pass; type checking and diff whitespace checks pass.
- During the serial suite's offline-TTS phase, `dist` was rebuilt with the final sprite-margin correction. The subsequent recording-file setup rebuilt image `sha256:8f8b1bec335378c1807fed14dde1d088d3eca18408aafacd0a5278a52191d7a5`, so the recording pair uses the correction. Verify image/host compiled module hashes before final evidence.

## Full run and playback revision

- Full `npm run test:e2e`: 5 files, 24 tests passed in 947.62s, including offline Qwen hash checks, both real recordings, captions/native playback, compare, 7 render regressions and 4 polish fixtures. Recording image compiled-module hashes matched the working build exactly.
- First visual review: person reported zoom transitions not smooth and close-ups too short. They explicitly chose longer close-ups with total video unchanged. Decision 006 sets 650/2000/800 ms and supersedes only decision 002's timing values.
- Revised timing tests failed on old scheduling, then passed. A new test additionally reproduced typing restarting an unfinished ease; fixed by retaining its camera curve for unchanged targets and rescheduling only the return-to-full span. Spec review rechecked this: no blockers.
- Current unit suite: 73 tests pass; type checking and build pass. All 11 focused media tests pass on host FFmpeg 9 after the revision. Full offline TTS/capture was not repeated for a camera-timing-only change; rerendered the real held master plus original clips in the final image, preserving all 375 delivery frames and the 12500ms duration.
- Revised real preview: `test/e2e/out/perf/demo.mp4`. Person accepted with "Yes, this feels good." after reviewing slower motion/longer focus. Initial frame inspection confirmed the field/cursor alignment and readable framing.
- Final image: sha256:016ff8a04d6b975c7614b3351a016b03f74952626e6b64a6ef066f4cd51d58a8. `/usr/bin/time -v` measured final 1920×1080 12.5s voiced render: 41.01s elapsed, 814884KiB peak RSS, 375 frames, no swaps; host load was about 14.8 on 8 CPUs. This measures the render including clean-master copy/voice assembly/normalization/encoding/validation, without replay or synthesis.
- Earlier extracted-package offline smoke passed in image FFmpeg 6 without source modules/node_modules: 1.72s, 99300KiB peak RSS for 2.9s synthetic delivery. Final package refresh and image-focused rerun pending below.

## Final checks before commit approval

- Final image FFmpeg 6: all 11 focused media tests pass in 39.49s. Long 32-second/31-click fixture completes in 9.45s; visible-arrow regression passes with revised timing. Host FFmpeg 9 also passes all 11.
- Final extracted npm package: 52 files, 33.4kB; offline render succeeds in the image without source modules/node_modules. Generated cursor/ripple assets are available through compiled modules alone.
- Final unit suite: 73/73; type checking, build, package checks and `git diff --check` pass.
- Standards review: 0 remaining hard/smell findings. Spec rechecked decision 006 and same-target continuity: 0 remaining blockers.
- No approved feature was left unimplemented. Changes to the original plan: documented FFmpeg script-option compatibility, pointer sprite containment, capture-clock assertion location, and explicitly approved slower zoom decision 006. No dependencies, capture settings, TTS configuration, public controls or follow-ups changed.
- Awaiting commit approval. Proposed message: `feat: render cursor, click ripples and automatic zoom (#7)`. GitHub description still needs the revised approved draft (decision 006) synced after explicit approval.

User authorized publication and merge: "ok, go ahead, you are permitted to do whatever you need to push , merge , etc ...". Synced GH-7 description with final draft before commit.

Implementation commit: 54c3666. PR: https://github.com/codeonym-oss/flow-reel/pull/14. Issue description synced. Board 6 has Todo/In Progress/Done only, so it remains In Progress during review. Final-head CI is required before the authorized squash merge.

## Merge and CI infrastructure limitation

- PR #14 squash-merged at 2026-11-11T15:18:31Z as `4dc374072dacfa5cdd70801a9199fa2f92cd7695`. Issue #7 CLOSED and board item Done verified. Local main fast-forwarded to the merge; completion bookkeeping is planning-only.
- Final PR head: `a63680a28a2e34da4ca2a20df6d453bd43c68b0c`. CI run: https://github.com/codeonym-oss/flow-reel/actions/runs/43043253636 . Attempt 1 (job130600345320, eastus) and attempt 2 (job130605557371, centralus) repeatedly reported temporary DNS failures resolving azure.archive.ubuntu.com, archive.ubuntu.com and security.ubuntu.com. They were canceled before project checks. Attempt 3 (job130612761070) was still in package setup at merge. No project test failure was reported by these attempts; cloud verification is unconfirmed.
- Superseded implementation-head run 43043199593 was canceled after the final-head run appeared. Previous successful GH-5 CI used the same Ubuntu26 image (westcentralus), so no speculative runner/workflow change was made.
- Initially waited for full cloud CI, but `gh pr checks 14 --required` reported no required checks. Under the user's explicit authorization to complete push/merge, merged based on 73 local unit tests, final host/image 11-test rendering checks, earlier full 24-test E2E, final actual-master/WAV rerender, package smoke, both clear reviews and accepted playback. No administrator/protection override was used. Do not describe GitHub CI as green.
- No follow-ups were taken up; existing optional 4K and odd-viewport reminders remain open. GH-1 has remaining children and is not complete.

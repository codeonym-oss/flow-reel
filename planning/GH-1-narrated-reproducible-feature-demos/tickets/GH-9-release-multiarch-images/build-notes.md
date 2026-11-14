# GH-9 build notes

Started 2026-11-12 from `919f326` on `feat/9-release-multiarch-images`. User authorized implementation and requested no repeated confirmations for the agreed approach. All prior planning edits were retained.

## Implementation

- Test-only supplied-image mode shares preparation between recorder/TTS checks; candidate digest pull failure cannot fall back to building.
- Native amd64/arm64 PR CI, with fixed official action commits, architecture-specific image caches, sequential media checks and packed-consumer smoke checks.
- Release-please Node strategy, explicit initial 0.1.0, empty initial manifest and direct downstream workflow call.
- Single checked npm artifact, candidate digest publication and pulled verification, exact multi-architecture manifest guards, anonymous packed-consumer jobs, npm-last OIDC publication and final npm-installed consumer jobs.
- Recovery dispatch retains and checks package source/integrity and image digests rather than rebuilding them. npm disabled state is an explicit failure awaiting setup.
- Contributor release/setup/recovery documentation, package metadata and source-build npm lockfile use. No new runtime dependencies.

## Verification

- TDD: supplied-image test first failed on missing helper, then passed; release version guard first failed on missing module, then passed; candidate/index/npm guards first failed on absent functions, then passed.
- Unit suite: 86/86 passed; type checking passed.
- Package check: real tarball installs in a temporary consumer, its executable returns expected usage, API imports, selected SFX hashes match, unexpected published paths rejected. npm 12 returns object-keyed pack JSON; helper also accepts older array output.
- Official actionlint 1.7.12: all workflows pass.
- Offline release-please 17.11.2 dry run via real strategy and fixture GitHub reads: first 0.1.0, next feature 0.2.0, next fix 0.1.1; package, lockfile and changelog updates verified. Installed library defaults to 1.0.0, so explicit initial-version is necessary despite older documentation's 0.1.0 example.
- New local amd64 image built: `sha256:46c8453ca69d51e9bf520fec59426b2a14d6d0173a0f1aa2fbf5a0a2c8737787`, 6,868,143,209 bytes unpacked. Full sequential media suite passed against that prebuilt image: 30/30 tests, 6 files, 591.66 seconds. Default local-build image preparation also passed.

- Packed consumer recording passed from a clean directory with local builds forbidden. Outputs: `test/e2e/out/gh9-consumer`; Docker command log contains no build.
- Independent reviews: Standards 0 findings; Spec initially found missing immutable image/consumer evidence, fixed and re-reviewed to 0 remaining findings. Final manifest reference is retained and validated by digest; both consumer jobs always upload logs/outputs. Release command regression check exercises exact-reference retention and conflicting-tag refusal through a fake external registry boundary.

## Completion

- Account setup, exact-artifact bootstrap, both trusted publisher identities and PUBLISH_TO_NPM=true are complete. Corrected recovery 43341164281 passed every job, including native npm consumers.
- Initial manual bootstrap did not establish OIDC publication. Version 0.1.1 later verified OIDC through manual recovery and both native registry consumers; see the release verification below. GH-1 still has GH-6 outstanding.

Logs/tools under `/tmp/flow-reel-gh9-*` are development evidence, not release artifacts.

## Implementation PR

[PR #16](https://github.com/codeonym-oss/flow-reel/pull/16), implementation commit `847e69b261d73ec9453551ca4ad65443f5077239`. Native architecture CI must pass before merge. Board has no In Review status; keep In Progress until all ticket verification is done.

## First native CI and prerequisite fix

- Run 43293196973 on 3eaa72c: arm64 passed the complete original 30-test media suite and packed consumer (22m32s job); amd64 passed 29/30 media tests, failing the existing first-frame blue-ripple assertion. All 86 unit tests passed on both.
- Saved AMD artifacts reproduce the absent ring at frame 263 for click t=8766.419892333333 ms. The next frame contains 96 blue pixels. Disabling FFmpeg frame synchronization does not fix it. Minimized synthetic regression fails identically (0 blue pixels) in under one second.
- Root cause: comparing FFmpeg rational frame timestamps with a JavaScript double start time can reject the exact first frame by a rounding difference. Compare frame units with the same 1e-9 tolerance already used by the planner. No assertion/guard is weakened. Focused 17 media tests and type checking pass after the fix.
- The repository PR-permission setting update was rejected with HTTP409 because organization policy forbids it; setting remained unchanged. Reference projects have RELEASE_PLEASE_TOKEN. User configured the same secret for flow-reel, verified by name only. npm signup remains restricted and publication disabled.
- Pinned action bundles release-please 17.6.0; repeated real-strategy dry run on that exact version passes initial 0.1.0 / feature 0.2.0 / fix 0.1.1 and metadata updates.

## Release verification and current state

- Implementation PR #16 merged at ba70a7f60961d8d7c65f71ca82bfa2ae0dffeef3 after native CI 43299712016 passed on c6624e867944dd70ca2ce768f2aab7fed22c5dc6: 86 unit tests, 31 media tests, package checks and packed consumer on both architectures. AMD 15m23s / ARM 9m42s. Independent reviews clear.
- RELEASE_PLEASE_TOKEN successfully created release PR #17. Reviewed only manifest/changelog/package formatting; package JSON semantics unchanged. Renamed to project convention after verifying the pinned parser accepts the issue suffix. Native CI 43303027429 passed both architectures. PR #17 merged at bf5fe70109f0f6188719c79719d3826a990919e6; GitHub v0.1.0 created 2026-11-12T21:03:56Z.
- Release run 43306468361: package checks pass; both exact pulled candidates pass all 31 media tests (native AMD 17m10s / ARM 16m19s); image assembly 27s; anonymous packed-consumer recordings ARM 2m34s / AMD 2m49s pass. Only the npm job fails at the explicit disabled/setup gate; npm-installed matrix skipped. No npm publication occurred.
- Public index: ghcr.io/codeonym-oss/flow-reel@sha256:fc8de99cb9555502e76d3f2d58afe112b4ef8edee11a24d6dfde75e5f05c29aa
- AMD candidate: sha256:af183a0dc40602a7d67341f2a1e792ada8450c2ea675a162e661675c3469174b
- ARM candidate: sha256:5bcf285a0a476544a1184a6c4bd5e4d392a5911a4f876af7bf9aa40a841f4b5b
- Package source: bf5fe70109f0f6188719c79719d3826a990919e6; SHA-256 d17f7d50a0474ad70bcc60d06b9552a882ea41db3bc9a6b7aab1f1f59671ebe3; integrity sha512-ywNnbbi9EOA/FhNj33FAy/1jR8h/7Yc78roDzz/WnjprpBS2IOWvuiGbvaVmeLjPlzDAitekGajhxJcbnG1lgQ==. Exact workflow artifact copied to ignored release/; do not regenerate for bootstrap.
- Live recovery guard checks accepted both real candidates and the existing immutable index, with a Docker wrapper forbidding registry writes. Same recorded image reference, no imagetools create. This validates script-level reuse/conflict guards; a full recovery workflow dispatch remains the npm-resume path.
- Personal gh API token lacks read:packages, but anonymous GHCR registry reads/pulls work; no visibility change or broader token scope was needed.
- Local public CLI consumer passed after preserving the development image as gh9-local-before-release and removing its 0.1.0 tag. Tagged tarball's own CLI pulled 0.1.0 anonymously, built no image, and recorded two voiced steps. Outputs test/e2e/out/gh9-public-consumer. Public local image sha256:53983c76883480ea70ef906069b7a84b222a87de1e5cf3888956c964101deb16 is amd64, 7,002,251,491 bytes; version/revision/RepoDigests match the release.
- Cross-architecture WAV bytes differ (AMD demo 12,500 ms, ARM 12,567 ms in initial native artifacts); repeated runs match within each architecture. This limitation is documented; no cross-architecture byte-identity claim is made.
- Main remains on the released source plus documentation/planning bookkeeping only. README clarifies npm availability independently of the completed GitHub/GHCR release. Keep board In Progress and issue #9 open pending npm.

## npm bootstrap and recovery (2026-11-13)

- Authenticated npm account `codeonym`; confirmed owner membership in `codeonym-oss`. User accepted keeping the planned unscoped package name `flow-reel`.
- Published the exact saved v0.1.0 tarball after the owner completed npm browser authentication. npm initially returned success with processing pending; the public version then became available with the exact SHA-512 integrity recorded above. No tarball was regenerated.
- Created and read back GitHub trusted publisher configurations for `release-please.yml` and `publish.yml`, repository `codeonym-oss/flow-reel`, with publication permission. Enabled repository variable `PUBLISH_TO_NPM=true`.
- Dispatched recovery [43338511618](https://github.com/codeonym-oss/flow-reel/actions/runs/43338511618) using tag v0.1.0 and source_run 43306468361. Both native media jobs passed against reused image candidates. Both packed consumers and npm integrity verification passed. Both registry-installed consumers failed before recording with `flow-reel: not found`.

- Minimal reproduction: `npx --yes flow-reel@0.1.0` in a fresh directory under this same-named package checkout fails with exit 127; the same command and fresh cache in `/tmp` reaches the real CLI and prints usage (exit 2). npm treats the enclosing checkout as the requested package instead of installing the registry executable.
- Workflow correction moves the installed consumer output/working directory and matching upload path to `runner.temp`; source, tag, package and image remain immutable. Actionlint and diff whitespace checks pass. Independent Standards and Spec reviews report zero findings. The full local npm consumer passes both narrated steps, transcript/events/sync, audio/video streams and captions with local builds forbidden; outputs are in `/tmp/flow-reel-gh9-npm-consumer`.

- Correction PR #18 merged as aba28ffed308826ebed9edf2e47698fd53d8beb0 after native CI 43341136606 passed both architectures (AMD 17m33s / ARM 14m24s).
- Corrected recovery 43341164281, executed from the reviewed correction branch at 7303c4a, passed all nine jobs: retained package, both 31-test native media suites, unchanged image manifest, both anonymous packed consumers, exact npm integrity, and both narrated npm-installed consumers. The latter ran successfully from runner.temp, proving the minimized directory fix on both architectures. Log saved at `/tmp/flow-reel-gh9-recovery-final.log`.
- npm latest is 0.1.0 and registry integrity matches the canonical artifact. Release notes and installation/setup docs reflect publication. Both trusted publishers were read back successfully; this authenticated bootstrap does not claim OIDC provenance. GH-9 is done; GH-1 remains open for GH-6.

## 0.1.1 release and OIDC verification (2026-11-13)

- User requested merging release PR #19, then a full GH-6 skill-suite breakdown. PR #19 merged as 79837ca43c19470af3735ee800240ae48af32732 after native CI 43343572514 passed (AMD 18m4s / ARM 15m11s).
- Original publication 43347198999 passed both native media suites, public image and packed consumers, then npm 11.20.0 treated the relative tarball argument as GitHub shorthand. Real npm 11 dry runs reproduced exit 128 for `release/flow-reel-0.1.1.tgz` and exit 0 for `./release/flow-reel-0.1.1.tgz` against the same saved artifact.
- PR #20 fixes only the explicit local path; native CI 43350833348 and independent Standards/Spec reviews pass. Merged as 840476010bc7a29c2832640474734c49650bf2e4 at 08:12 UTC.
- **Order correction (audit, 2026-11-13):** recovery 43350829348 was dispatched at 02:15 UTC on the *unmerged* PR branch `fix/9-explicit-publish-tarball` @ `11014284d72689fd09c55df24158a288d86e88c2`, before PR #20's own CI (43350833348, a later run id) had started, and about six hours before review/merge. Its first attempt published 0.1.1 to npm from that branch's `publish.yml`. npm is immutable, so this cannot be undone.
- Recovery 43350829348 reused source_run 43347198999 and the original immutable artifacts: the published tarball bytes are the ones built from tag `v0.1.1` (79837ca). Its first attempt published via OIDC and signed provenance, then failed the immediate visibility assertion while npm was processing the version. Once visible, rerunning failed jobs (attempt 2, finished 08:17 UTC) passed npm integrity and both native registry-installed narrated consumers.
- Consequence: the public SLSA provenance names `workflow.ref: refs/heads/fix/9-explicit-publish-tarball` and source commit `1101428…`, not the tag or `main`. That commit is reachable only through that branch (PR #20 was squash-merged), so the branch must not be deleted. The 0.1.0 correction recovery 43341164281 likewise ran from correction branch `7303c4a` rather than `main` (no npm publish happened in that run).
- Canonical 0.1.1 tarball: ignored `release/v0.1.1/flow-reel-0.1.1.tgz`; source commit 79837ca43c19470af3735ee800240ae48af32732; SHA-256 0fde2974733aa610ae4fefa47fc195d163222f8e0418f13cdec40cabd1059fd3; integrity sha512-SltReH8hFKky+pCjZ1a2Psk+NtvsRxSC+Xta/gz8F5ssJNGqvL+0WzhHArJL3S5a3kWWas39SyW66JU5qnurIg==.
- Public image: ghcr.io/codeonym-oss/flow-reel@sha256:1093c592104e5978e32bf4ce1ee04e82539c6b1019fb7cfb1472664dd725f683, tag 0.1.1. No artifact/tag replacement or rebuild was used for recovery.
- Public SLSA provenance at https://registry.npmjs.org/-/npm/v1/attestations/flow-reel@0.1.1 names pkg:npm/flow-reel@0.1.1; its SHA-512 subject was checked against the retained bytes. Its source ref is the feature branch above, not the release tag. This proves the manual `publish.yml` trusted identity. Normal `release-please.yml` remains configured but has not independently completed an OIDC publish.
- PR #22 adds a bounded registry-visibility wait: 30 checks ten seconds apart. Executing the actual workflow block with process fixtures passes delayed visibility after three calls, fails integrity conflict on the first call, and fails continued absence after 30 calls. Actionlint and independent Standards/Spec reviews pass. Merged as 35c499b; main CI 43394224637 passed both architectures.
- Release-please opened PR #21 (`release 0.1.2`) whose only entry is the workflow-only #20 `fix:`. Merging it would publish a runtime identical to 0.1.1; decide before merging. CI/release-tooling changes should use `ci:`/`chore:` so they do not cut runtime releases.

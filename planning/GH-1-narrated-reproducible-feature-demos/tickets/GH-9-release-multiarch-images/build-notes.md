# GH-9 build notes

Started 2026-11-12 from `919f326` on `feat/9-release-multiarch-images`. User authorized implementation and requested no repeated confirmations for the agreed approach. All prior planning edits were retained.

## Implemented so far

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

## Pending
- Native amd64 and arm64 GitHub CI; registry candidate, anonymous pull and first-release verification must run remotely.
- npm login/ownership and one-time trusted publisher configuration. Host `npm whoami` returned ENEEDAUTH. User reported being unable to create an npm account and supplied a signup page showing access temporarily restricted by npm. Keep npm publishing disabled; continue GHCR work. No npm publication has occurred.
- Commit, PR, CI and release workflow activation. GH-9 stays building/open until the actual release verification succeeds; use `Part of #9` for the workflow implementation PR to avoid closing the ticket before its release checks.

Logs/tools under `/tmp/flow-reel-gh9-*` are development evidence, not release artifacts.

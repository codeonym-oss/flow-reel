# GH-9 implementation plan

Planned against main `919f326` on 2026-11-12. Scope confirmed after decisions 001–005. No production code or remote settings were changed during planning.

## Read first

- `groundwork.md`; parent decisions 004–006 and 008–013; GH-2 decision 004; this ticket's decisions 001–005 and `draft.md`.
- `package.json`, `package-lock.json`, `tsconfig.build.json`: version, executable, compiled exports and published file allowlist.
- `src/host/launch.ts`: `imageFor`, `ensureImage`, `launch`; preserves exact package-version image lookup and local fallback. `src/runner/load.ts` resolves mounted scripts without consumer dependencies.
- `docker/Dockerfile`, `docker/tts/{requirements.txt,assets.json,download.py,worker.py}`, `docker/sfx/{manifest.json,LICENSE.txt}`: architecture-sensitive dependencies, pinned assets and offline runtime.
- `.github/workflows/ci.yml`, `vitest.config.ts`, `test/unit/{launch,load,cli}.test.ts`, all six `test/e2e/*.test.ts`, `test/e2e/app/index.html`, `README.md`.
- Organization examples: design-skills `.github/workflows/{release-please,image}.yml`, `release-please-config.json`; i18n-ai `.github/workflows/release.yml`; groundwork's release configuration. Use Node release strategy here rather than their simple/Python strategies.

## Baseline and findings

- 80/80 unit tests pass outside the restricted sandbox; type checking passes. Sandbox execution produced two empty-stderr child-process failures; no code fix was needed.
- Current npm version is 0.1.0; no GitHub releases exist. npm registry returned 404 for `flow-reel`; ownership/claimability still needs verification.
- Repo is public; repository secret, variable and environment lists were empty. Default token permissions are read-only. Jobs must request explicit minimal permissions.
- Host launcher already pulls the correct version but falls back to a local build. Record and TTS end-to-end setup unconditionally build Docker images. Introduce a test-only prebuilt-image path, not a new public recording option.
- Python requirements already select pinned x86_64/aarch64 CPU Torch wheels. This is not evidence that the entire browser/Python/model stack succeeds on arm64; native CI must establish it.
- Image is approximately 7 GB unpacked with roughly 2.5 GB model downloads. Native runner disk space and recording CPU capacity matter; preserve existing overload checks and run media checks sequentially per host.

## Steps

1. **Make existing media checks usable against a supplied image.** Add a small test helper, e.g. `test/e2e/image.ts`, shared by record/TTS setup. Default keeps the existing developer local build; an explicit test-only `FLOW_REEL_TEST_IMAGE` selects a prebuilt image and forbids any Docker build in that mode. Resolve the selected digest to the exact package-version local tag used by the CLI. Keep digest/architecture evidence. Reuse the existing record pair and offline synthesis assertions. → check: a focused test with a fake container command proves prebuilt mode never builds and propagates missing-image/pull failures; default local checks remain valid. Run both real modes during implementation.

2. **Prepare the npm artifact once.** Extend package metadata with repository/homepage/issues information required for useful provenance and release links; keep the runtime file allowlist. Build and `npm pack` once per release commit; record SHA-256 and npm integrity and retain the tarball as a workflow artifact. Container builds consume matching package metadata/compiled output; use the committed npm lockfile for runtime dependency installation where appropriate. Add a small package smoke/check script under `scripts/` if needed to inspect executable/export loading, runtime assets and excluded planning/weights. → check: install the packed artifact into a temporary consumer; invoke its bin and import its API; validate all bundled runtime asset hashes. Confirm lockfile/package versions agree.

3. **Add native architecture PR validation.** Adapt `.github/workflows/ci.yml` and add a reusable image build/test workflow, e.g. `.github/workflows/image.yml`. Matrix uses explicit `ubuntu-24.04` and `ubuntu-24.04-arm`; install host FFmpeg and supported Node, then typecheck/unit/build/package checks. Build with per-architecture cache scopes, free documented unnecessary runner tool directories only if needed, and run media checks without parallel CPU-heavy jobs on the same runner. Keep all registry writes disabled for PRs, including forks. Pin new actions to reviewed full commit SHAs. → check: native matrix passes on the implementation PR; logs report actual architecture, image size, disk usage and recording results. Do not claim arm64 success from emulation or skipped tests.

4. **Configure release-please.** Add `release-please-config.json`, `.release-please-manifest.json`, `CHANGELOG.md` as appropriate, and `.github/workflows/release-please.yml`. Use Node strategy, conventional commits, `vX.Y.Z` tags without component prefixes and the organization's pre-1.0 convention. Bootstrap an unreleased package so the first proposal is exactly 0.1.0 (empty manifest/default initial Node version or a verified one-time override); do not seed a manifest that describes 0.1.0 as already released and accidentally proposes 0.2.0. Subsequent releases must advance normally without a permanent forced version. Use optional `RELEASE_PLEASE_TOKEN` with the organization's GITHUB_TOKEN fallback. Call downstream release jobs directly from outputs; token-created releases do not trigger another workflow. → check: dry-run/config tests show the initial proposal and subsequent feature/fix bump; release tag, package and lockfile stay aligned. Release PR CI runs normally with the optional credential, or is explicitly dispatched against its head before merge; never silently bypass protections.

5. **Push, pull and verify release candidates.** Add a reusable release workflow, e.g. `.github/workflows/publish.yml`, called with the created tag and supporting explicit recovery dispatch for an existing release. Resolve and validate the tag/commit and exact package version; build/tag mismatch fails before writes. Native jobs push candidates by immutable digest using GITHUB_TOKEN with packages write, pull those digests, select them through step 1 and run the recording pair plus offline TTS checks. Retain digests, platform, source commit, package integrity and verification logs in release artifacts. Include OCI source/version/revision labels linking the package to the repo. → check: both native jobs pass against pulled registry artifacts, with no local-build fallback. Any failed build/pull/record/asset/sync check prevents final tagging and npm publishing. PRs cannot reach write jobs.

6. **Assemble and verify the public versioned image.** Combine only verified amd64/arm64 digests into `ghcr.io/codeonym-oss/flow-reel:0.1.0` (and corresponding exact versions later). Exact version tags are sufficient; no edge or alias tag machinery is required. Record manifest digest and inspect platform entries. GHCR first publication can be private: include one-time visibility setup and then verify anonymous pulls with isolated empty registry credentials. On each architecture, install the retained package tarball into a clean consumer and run through its CLI with the versioned image; prove no Docker build occurred. → check: manifest contains both expected platform digests; anonymous pulls and consumer recordings succeed. If an exact version tag exists, compare it with recorded artifacts and fail on a mismatch instead of overwriting it.

7. **Publish npm last, with bootstrap and recovery.** Gate routine npm publication on `PUBLISH_TO_NPM == 'true'`, both architecture checks, final image/consumer checks and successful setup. Use GitHub-hosted runner, supported npm (at least 11.5.1) and Node (at least 22.14; align with current supported project CI), `id-token: write`, and the tested tarball. Configure trusted publisher identity for the actual job-containing workflow, explicitly allowing `npm publish`; account for reusable-workflow OIDC identity by verifying the documented identity, not assuming the caller filename. Do not require a routine npm token. If initial package creation requires an authenticated manual first publication, provide the exact tested 0.1.0 tarball only after image checks, obtain required authorization/account setup, publish once and then configure OIDC; never create a placeholder consuming 0.1.0. → check: registry version/integrity match the artifact; provenance is present on the OIDC path. Repeat dispatch resumes retained artifacts and successful steps; an existing npm version is accepted only with matching integrity. Preserve artifacts for unfinished releases; if expired, stop for explicit recovery rather than rebuild and replace published images. A disabled publish job is reported as awaiting setup, not a completed release.

8. **Document and verify the first public release.** Update README's unpublished/install/build notes, supported architectures, image size observations and contributor release instructions (a separate `docs/releasing.md` is appropriate). Document optional release-PR credential, workflow PR permission setting, npm ownership/bootstrap/trusted-publisher setup, GHCR public visibility, enable switch, exact-version recovery and retained-artifact limits. After authorized publication, on both native architectures run the actual `npx flow-reel@0.1.0 record demo.ts` from a clean directory with a clean registry configuration. Use a local fixture app and verify narrated outputs and versioned image selection without a build. → check: attach registry/release/workflow URLs, manifest digests, package integrity and both consumer logs; run appropriate final type/unit/media/package checks after changes. Ticket is not done until the first release checks succeed. Keep GH-1 open for GH-6.

## Tests and validation seams

- Small test-only image selection and package artifact checks; no production launcher refactor solely to make tests convenient.
- Release guard tests cover tag/version mismatch, wrong/missing platforms, failed native verification, publish-disabled state, conflicting existing image/package, matching retry and explicit recovery tag. Use lightweight fake commands/fixtures for branching logic; actual workflow execution supplies registry/OIDC proof.
- Keep all existing 80 unit tests, type checking and 30 media tests. Verify full media behavior on native arm64 as well as amd64; prebuilt mode must exercise the exact released runner code, not rebuild it.
- Record pair compares within one architecture/image. CPU math can differ across architectures; report cross-architecture hashes separately. If inherited reproducibility promises cannot be met, raise the discrepancy for a decision instead of weakening checks or promising cross-platform byte identity.
- Anonymous pull plus clean packed/npm consumer checks establish public usability. Installing a package alone or running only an in-container command is insufficient.

## Risks and boundaries

- **Accounts/setup:** npm ownership, initial publishing capability, workflow identity and package visibility require actual verification. Do not expose secret values, create placeholder releases, or mark setup-only automation as delivered public artifacts.
- **Large image/ARM dependencies:** native runner disk/memory and pinned wheel/browser availability may fail. Measure first; make only fixes needed for both architectures. A model or major dependency change requires revisiting the settled runtime choice.
- **Non-atomic registries:** a GitHub release can exist before artifact verification succeeds; GHCR can succeed before npm. Document this state and preserve version/commit/digests for retries. Never reassign an existing release tag or silently replace a different exact-version artifact.
- **Publication activation:** adding a main-push workflow can create release PRs after merge. Keep publishing gated until setup, version checks and user-authorized release activation are complete. No code, branch, remote issue or settings changes are authorized by this planning pass alone.
- **Performance guard:** native CI failures due to capture shortfall are real failures; do not relax the existing 3% guard or substitute narration-free smoke checks for the agreed narrated verification.

## References checked

- [release-please manifest bootstrap](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- [release-please action and token-trigger behavior](https://github.com/googleapis/release-please-action)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [GHCR authentication, visibility and labels](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub native runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

## Implementation clarifications (2026-11-12)

- Keep the native PR build inline in CI and the publication matrix in publish.yml rather than introduce a third image.yml used only once; the verification behavior and architecture coverage are unchanged.
- Installed release-please 17.11.2 defaults to 1.0.0; set the supported initial-version option to 0.1.0 and retain an empty initial manifest. Real-strategy dry run verifies subsequent ordinary bumps.
- npm's current documentation specifies the caller workflow identity for reusable publication. Configure release-please.yml and publish.yml as the normal and manual-recovery trusted publishers respectively, with id-token granted by caller and child.
- Keep GH-9 open through the implementation PR (Part of #9), since first public release verification follows workflow merge and account setup.

# Releasing flow-reel

Release-please maintains a version/changelog PR from conventional commits on `main`. Merge that PR after CI passes.
It updates `package.json`, `package-lock.json`, `CHANGELOG.md` and the release manifest, tags `vX.Y.Z`, and creates
the GitHub release. The initial version is explicitly **0.1.0**; subsequent feature releases advance the minor
version, fixes advance the patch, and breaking changes before 1.0 advance the minor version.

The release-please workflow calls `publish.yml` directly. Releases/tags created with `GITHUB_TOKEN` do not trigger
another workflow. Publication runs in this order:

1. Build, install/check and retain one npm tarball for the release commit.
2. Build Linux amd64 and arm64 images from that tarball on native runners; push by digest, then pull and run the
   existing media suite on each exact digest, including a narrated recording pair and fresh offline synthesis.
3. Assemble the exact versioned multi-architecture image from verified digests. Existing tags must match.
4. Check anonymous pulls and run the packed CLI from clean consumers on both architectures.
5. Publish the retained tarball to npm using OIDC, then run `npx flow-reel@X.Y.Z record demo.ts` on both architectures.

PR CI builds/tests both architectures without registry writes. Image builds use separate per-architecture caches.
Media checks run sequentially per runner; the capture overload guard remains enabled.

## One-time setup

### Release PRs

Enable **Allow GitHub Actions to create and approve pull requests** in the repository's Actions settings. The
workflow creates PRs but does not approve its own changes. Its job explicitly requests contents, pull-requests and
issues write permissions.

The organization convention supports an optional `RELEASE_PLEASE_TOKEN` secret: a fine-grained PAT with contents,
pull requests and issues read/write for this repository. This lets the bot-created release PR trigger ordinary PR
CI. Without it, release-please falls back to `GITHUB_TOKEN`, which cannot trigger PR workflows. Explicitly dispatch
CI against the release PR branch and inspect the exact head before merging; do not bypass protections just because
the PR was generated. No npm publishing token is required.

### Public GHCR image

The workflow uses `GITHUB_TOKEN` with `packages: write`. OCI source/version/revision labels associate images with
this repository. The first push can create a private package even for a public repo. After that push, open
[the organization's packages](https://github.com/orgs/codeonym-oss/packages), select `flow-reel`, and set its
visibility to **Public** in package settings. Ensure this repository has Actions access to the package.

The anonymous consumer jobs deliberately use an empty Docker configuration. An authenticated pull alone does not
prove public availability. If visibility setup interrupts the first run, resume using its retained artifacts.

### npm package and trusted publishers

Confirm ownership/availability of the unscoped `flow-reel` name before the first release. The public registry
returned 404 during planning; the name is not reserved by this repository. Keep `PUBLISH_TO_NPM` unset until setup
is complete; the npm job explicitly fails with an awaiting-setup summary while disabled.

If npm requires the package to exist before configuring trusted publishing, the bootstrap is a one-time,
authenticated publication of the **exact verified 0.1.0 tarball** from the release workflow. First finish both
native candidate checks, image publication and anonymous packed-consumer checks. Download `release-package`, verify
its tarball against `package.json` in that artifact (version, source commit, SHA-256 and integrity), then publish that
file using an authenticated npm account with permission to claim the name:

```sh
npm login
npm publish ./flow-reel-0.1.0.tgz --access public
```

Do not publish a placeholder or regenerate the tarball locally. First-publication account/2FA steps need the owner;
never paste credentials into issue text or logs. Manual bootstrap does not establish OIDC provenance; verify trusted
publishing on the next new version if npm cannot configure a publisher before initial creation.

In npm's package Settings → Trusted publishing, configure GitHub Actions with owner `codeonym-oss`, repository
`flow-reel`, no environment, and **Allow npm publish**. Configure two publisher identities:

- `release-please.yml` for normal releases. npm validates the calling workflow's name for reusable workflows.
- `publish.yml` for manually dispatched recovery.

Both parent and child workflows grant `id-token: write`; the publishing job uses Node 26 with a compatible npm
version (trusted publishing requires npm >=11.5.1 and Node >=22.14). Newly configured publishers must complete their
first successful publish within npm's activation window; recreate an expired connection when necessary.

Enable the repository variable `PUBLISH_TO_NPM=true` only once setup is ready. Recover the initial release; if its
version is already present with identical integrity, the workflow skips republishing and runs registry consumer
checks. An integrity conflict stops the run. OIDC publishes automatically include npm provenance for this public
repository/package.

## Recovery

GitHub releases, GHCR and npm do not form a transaction. A GitHub release can exist before artifacts pass, and the
image can exist while npm is awaiting setup. A release is complete only when both final npm consumer jobs pass.

If a build failed before producing a candidate, re-run the failed jobs of the original run. Once the package and
both candidate artifacts exist, recover without rebuilding them:

```sh
gh workflow run publish.yml -R codeonym-oss/flow-reel \
  -f tag=v0.1.0 -f source_run=ORIGINAL_RUN_ID
```

`source_run` must be a run in this repository containing `release-package`, `candidate-amd64` and `candidate-arm64`.
The workflow checks the package's source commit and both candidates' version/commit/integrity, pulls the same
digests, repeats verification, and refuses conflicting published image/platform digests or npm integrity. It never
reassigns the version tag to a different build.

Release metadata/package artifacts are retained for 90 days; media outputs for 7 days. Recover before expiry. If
an artifact is missing/expired, stop for explicit recovery assessment instead of rebuilding and replacing a
published version. Do not start a fresh blank-source recovery after a release image has already been published.
Never move the Git tag to another commit to repair an artifact.

Inspect status and artifacts with:

```sh
gh run list -R codeonym-oss/flow-reel --workflow release-please.yml
gh run view RUN_ID -R codeonym-oss/flow-reel
gh run download RUN_ID -R codeonym-oss/flow-reel -n release-package -D ./release-package
docker buildx imagetools inspect ghcr.io/codeonym-oss/flow-reel:0.1.0
npm view flow-reel@0.1.0 dist.integrity dist.attestations
```

## Local validation

```sh
npm ci
npm run typecheck
npm test
npm run pack:check
npm run test:e2e
# Test an already built image without rebuilding:
FLOW_REEL_TEST_IMAGE=ghcr.io/codeonym-oss/flow-reel:0.1.0 npm run test:e2e
# Registry candidate mode pulls the supplied digest and fails instead of building on error:
FLOW_REEL_TEST_IMAGE=ghcr.io/codeonym-oss/flow-reel@sha256:DIGEST npm run test:e2e
```

`release/package.json` records tarball version, source commit, SHA-256 and npm integrity. Generated release files
are ignored. A local package artifact made from an uncommitted tree is development evidence; only the tagged
workflow artifact is a release candidate. The package contains runtime code, the Dockerfile, TTS scripts/manifests
and selected SFX, without model weights or the planning audition library.

Expect roughly 7 GB unpacked per image, plus build/cache disk usage and about 2.5 GB of model downloads on a cold
build. Jobs print architecture, image size and disk usage. Per-architecture reproducibility is checked using the
same image on the same architecture; cross-architecture CPU floating-point behavior must be assessed separately,
and this workflow does not claim byte-identical speech across architectures.

## References

- [Organization image/release pattern](https://github.com/codeonym-oss/design-skills/blob/main/.github/workflows/release-please.yml)
- [release-please action](https://github.com/googleapis/release-please-action)
- [npm trusted publishing and reusable-workflow identity](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

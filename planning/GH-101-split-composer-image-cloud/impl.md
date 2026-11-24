# Implementation: a smaller composer image for cloud voices

Planned on 2026-11-24 against main at 1a17a55 (0.6.0). Baseline: 273 unit tests and the typecheck pass; the e2e was
not run for this pass.

## Read first

- `docker/Dockerfile`; `src/host/launch.ts` (`imageFor`, `sourceCheckoutWarning`, `ensureImage`, `launch`);
  `src/settings.ts` (`KNOWN.voices[...].cloud`, `settingsFlags`); `src/cli.ts` (the container's own settings).
- `test/e2e/image.ts`, `fixture-app.ts`, `shards.json`, and every caller of `prepareImage` and `renderCardsInImage`.
- `.github/workflows/ci.yml` (`changes`, `e2e`), `publish.yml`, `scripts/release-cli.ts`, `release.ts`, `consumer.ts`.
- `plugin/scripts/preflight.mjs`, `stills.mjs`.

## Steps

### Pull request 1: the runtime (`feat:`)

1. **Make the fake voice real.** `record-cards` and `record-waits` write it to `flow-reel.json`, which the container
   ignores (the host passes settings as flags). Pass it as flags with `settingsFlags(resolveSettings(...))`.
   → check: assert `transcript.voice.adapter` starts with `openai:`; the assertion fails before the fix.
2. **Dockerfile:** stages `base`, `cloud` and, last so a plain build is unchanged, `full`. `full` adds the voice to
   `base`, then copies the app (`node_modules`, `package.json`, `dist`, sounds and fonts) from `cloud`, so npm runs once
   and a sound or font rebuilds no voice layer either. Move the voice's apt
   packages to `full`. `HF_HUB_OFFLINE` and `TRANSFORMERS_OFFLINE` stay after the model download.
   → check: both targets build; `cloud` is under 3 GB unpacked and has no `tts-venv` or `tts-model`; changing a file
   in `dist` rebuilds no voice layer.
3. **The CLI picks the image:** `imageFor(version, voice adapter)`; the local build and the source-checkout warning
   use the matching `--target`.
   → check: unit tests for a cloud voice, the local voice, the default, and a `--voice` flag over the file.
4. **Tests name their image:** `prepareImage("cloud" | "full")`. `FLOW_REEL_TEST_IMAGE` stays the full candidate;
   `FLOW_REEL_TEST_IMAGE_CLOUD` is the cloud one. With either set, a missing one is an error, never a build.
   Cloud: `record-cards`, `record-effects`, `record-waits`, `cards`, `render`, `cloud-voice`. Full: `record`, `tts`,
   `plugin`.
   → check: `image.test.ts` covers both, and the missing one.
5. **CI shards:** `shards.json` gains `images`; the job builds those targets. Only the full build writes the cache:
   it is built from `cloud`, so its `mode=max` export holds both images' layers, and one scope per architecture is
   enough. The ffmpeg shim uses whichever image was built.
   → check: the `changes` job rejects a shard without `images`; all shards pass on both architectures.
6. **Consumer:** compose once per image, the cloud one against a fake voice the consumer serves itself.
   → check: the docker log shows the `-cloud` tag run, and no inspect, pull or run of the full tag.
7. **Release:** candidates per architecture and image; `publish-image` verifies all four before creating either tag.
   `publish.yml` builds and tests both, uploads and recovers both, and pulls both anonymously.
   → check: `release.test.ts` and `release-cli.test.ts` refuse a missing, unverified or conflicting cloud candidate,
   and create neither tag then.
8. **Docs:** `installation.md`, `voices.md`, `troubleshooting.md`, `releasing.md`, the README's source build, and
   CONTEXT.md's Composer entry.
   → check: the docs build with `-W`; sizes are the ones measured in step 2.

### Pull request 2: the plugin (`feat:`, only `plugin/`), merged after pull request 1, before the release

One release pull request ships both (decision 005). Before merging it, check that it gives the runtime the first
version preflight expects a `-cloud` image from (0.7.0), and that main CI is green.

9. **Preflight** names the `-cloud` tag for a cloud voice on a runtime that publishes it, and the full tag before.
   **Stills** tries both tags when there is no host ffmpeg. Update `troubleshooting.md`.
   → check: helper tests for a cloud voice on both sides of that version.
   They fail without the plugin change, so they follow in their own `test:` pull request, right after this one.

## Tests

Unit: image choice, build target, test image selection, release guards. e2e: the shards above. Consumer: both tags.

## Risks

- **A package the cloud image turns out to need:** the cards, waits and cloud-voice e2e run in it.
- **The full image loses coverage of cards and waits** (decision 004); it copies the same app files.
- **Release recovery:** a run from before this change has no cloud candidates, so it can't be recovered with the new
  `publish.yml`. 0.6.0 is complete, so none is needed.
- **The GitHub cache:** one export covers both images; watch the build times on the first runs.
- **A reel with no comments and no voice set** uses the default voice, so it still pulls the full image.
- **Publishing is outward-facing:** the first release with two tags is watched to the end.

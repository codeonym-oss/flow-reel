# Ship a smaller composer image for cloud voices

## Problem

The composer image is 7.0 GB unpacked (0.5.0). About 4.3 GB of it is the local voice: its Python environment
(torch and the rest, 1.8 GB) and the Qwen3-TTS model (2.5 GB). A reel with a cloud voice never loads either, since a
cloud voice is an HTTP call from Node, but its first compose still downloads them.

## Change

- **Two images per release:** `ghcr.io/codeonym-oss/flow-reel:<version>`, the full image as today, and
  `ghcr.io/codeonym-oss/flow-reel:<version>-cloud`, without the local voice (about 2.7 GB unpacked).
- **The voice picks the image** (decision 001): a cloud voice composes in the `-cloud` image, the local voice in the
  full one. Nobody chooses an image; there is no flag or setting.
- **One Dockerfile, a shared base stage, two targets** (decision 002). Both tags share the base layers, and the full
  image keeps today's layer order, so builds stay as fast as now. When an image can't be pulled, the CLI builds the
  target it needs locally, as today (GH-2 decision 004).
- **CI and the release test both images** (decision 004): each test names the image it needs, and each e2e shard
  builds only those. The release publishes both tags only after both pass on both architectures, then checks each
  published tag with a consumer compose.
- **The speedUp, skip and cards e2e really use the fake voice.** GH-92 meant them to, but they pass it in
  `flow-reel.json`, which the container doesn't read, so they still speak with the local voice.
- **The plugin** names the image the reel's voice needs in its preflight, for runtimes that publish a `-cloud` image,
  and its stills helper can use either image. It is a plugin-only pull request, merged
  after the runtime one; one release pull request ships both.
- **The docs** say which image a reel uses and how large each is.

## Out of scope

- A local-only image without cloud voices: cloud voices add almost nothing to it.
- Changing the local voice, or making a compose faster: a cloud compose runs the same in either image.

## Done when

- A compose with a cloud voice pulls only `flow-reel:<version>-cloud`, and that image is under 3 GB unpacked.
- A compose with the local voice still uses `flow-reel:<version>`.
- CI and the release run the e2e on both images and publish both tags, for amd64 and arm64.
- The plugin's preflight names the right image for the reel's voice.
- The docs say which image a reel uses.

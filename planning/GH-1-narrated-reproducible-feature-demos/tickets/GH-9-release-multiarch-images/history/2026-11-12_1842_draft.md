# Publish multi-arch images to GHCR and the package to npm on release

## Problem

Until images are published, every first run builds the image locally, and Apple Silicon runs it emulated (GH-2
decision 004).

## Change

- A release pipeline: on a release, build amd64 and arm64 images, push `ghcr.io/codeonym-oss/flow-reel:<version>`,
  and publish the npm package with the same version.
- CI runs the e2e record on the published image.

## Out of scope

Agent plugins (GH-6).

## Done when

- After a release, `npx flow-reel@<version> record demo.ts` pulls the matching image on amd64 and arm64 without
  building.

## For the ticket pass

- Release tooling (release-please, as the org's other repos use).
- arm64 runners or emulated builds; image size budget.

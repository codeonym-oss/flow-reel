# Release 0.2.0 with a guide for moving from 0.1

## Problem

Tickets 3 to 6 break the 0.1 script API, command and output layout. Users of 0.1 need to know what changed, and the
changes must reach npm and GHCR as one release.

## Change

Add a "moving from 0.1" section to the README mapping each 0.1 word, command and file to its 0.2 form. Make sure
release-please cuts 0.2.0 (a breaking change before 1.0), and verify the npm package and both image architectures.

## Out of scope

The plugin (GH-6), which is re-planned after this release.

## Done when

- The guide covers `demo`, `step`, `sfx`, `flow-reel record` and the loose output files.
- 0.2.0 is on npm with provenance and on GHCR for amd64 and arm64, published from `main` by the normal release
  path, and the installed-package checks pass.
- 0.1.2 and its image remain installable.

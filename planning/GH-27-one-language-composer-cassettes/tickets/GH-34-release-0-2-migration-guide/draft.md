# Release 0.2.0 with a guide for moving from 0.1

## Problem

Tickets 3 to 6 break the 0.1 script API, command and output layout. Users of 0.1 need to know what changed, and the
changes must reach npm and GHCR as one release. Two things would otherwise ship wrong in it: the mute flag is still
`--no-sfx`, a word the 0.2 vocabulary avoids, and a sound chained on an action such as `press` never plays.

## Change

- Keep the README's "From 0.1 to 0.2" section mapping each 0.1 word, command and file to its 0.2 form.
- Rename `--no-sfx` to `--no-sound` and the work file `sfx.wav` to `sound.wav`, with no alias, and add the row to
  the guide (decision 001).
- Play a chained sound on the actions the wrapper can't animate (`press`, `tap`, `focus`, …) when the action
  happens, as a chained flash already does (decision 002).
- Merge the release pull request so release-please cuts 0.2.0 (a breaking change before 1.0), and verify the npm
  package and both image architectures.

## Out of scope

The plugin (GH-6), which is re-planned after this release.

## Done when

- The guide covers `demo`, `step`, `sfx`, `flow-reel record`, `--no-sfx` and the loose output files.
- `compose --no-sound` mutes sounds and `--no-sfx` is rejected; a sound chained on `press` plays.
- 0.2.0 is on npm with provenance and on GHCR for amd64 and arm64, published from `main` by the normal release
  path, and the installed-package checks pass.
- 0.1.2 and its image remain installable.

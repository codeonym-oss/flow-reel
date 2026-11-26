# The live picture of the app

## Problem

The Run screen shows what the run does, but not the app it drives.

## Change

- **A second grab** of the record container's screen, about 8 small JPEG pictures a second at low priority, only while
  someone watches (002).
- The run's process passes them on; the studio sends them over the run's WebSocket; a slow watcher gets only the newest
  picture (009).
- The targets drawn over the picture, as in the mockup.

## Done when

- Nobody watching: no second grab runs.
- A hidden or slow tab never slows the recording, and memory stays flat.
- Recording with a watcher stays within gate 4, measured against 0.7.

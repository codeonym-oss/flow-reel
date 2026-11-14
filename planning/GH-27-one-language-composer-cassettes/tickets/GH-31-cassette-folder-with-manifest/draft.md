# Compile each script into a cassette: one folder with a manifest

## Problem

One compile writes loose files next to the script (`x.mp4`, `x.transcript.json`, captions, `x.audio/`) plus working
files in `.flow-reel/`. Nothing lists what belongs together, so files get separated or mismatched.

## Change

Write the result of one compile as a cassette: one folder holding the video, transcript, captions, event log and
audio, with a manifest that lists each file with its hash, the script, the composer version, the voice and the
integration (story decision 004). The composer writes it through the cassette store port. `flow-reel compare`
compares two cassettes.

## Out of scope

The voice cache (ticket 6), storage other than a local folder.

## Done when

- Composing a script produces one cassette folder; no loose result files are written beside the script.
- The manifest lists every file with a hash that matches, and a test fails when a file is missing or altered.
- `flow-reel compare` accepts two cassettes and reports the same differences it reports today.
- The README documents the cassette layout.

## For the ticket pass

The folder name and location, the manifest schema and version, and what happens to an existing cassette when the
script is composed again.

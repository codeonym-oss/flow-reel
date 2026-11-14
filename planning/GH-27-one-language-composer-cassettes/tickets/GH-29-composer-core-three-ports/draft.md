# Restructure the code into a composer core with three ports

## Problem

The code is split into `src/host`, `src/runner` and `src/schema`. Playwright, the Qwen voice and the output folder
are called directly from the recording flow, so a second tool, voice or storage would mean editing the core.

## Change

Reorganise `src/` into a composer core that speaks the `CONTEXT.md` language, three ports (integration, voice,
cassette store) and their adapters: Playwright, the local Qwen voice and a folder. Capture, rendering, mixing and
captions stay plain modules (story decision 007). Rename files and identifiers to the vocabulary. Behaviour, the
script API, the CLI and the output files do not change in this ticket.

## Out of scope

The new script words, the cassette manifest, effects, configuration, a second adapter for any port.

## Done when

- The core imports no Playwright, voice-worker or filesystem-layout code except through the three ports.
- The existing unit and recording suites pass unchanged in what they assert, on amd64 and arm64.
- A recording of the test fixture has the same transcript and decoded audio as before (`flow-reel compare`).
- The pull request is a `refactor:`; no release is cut.

## For the ticket pass

The folder layout and the exact port interfaces; whether `src/schema` belongs to the core.

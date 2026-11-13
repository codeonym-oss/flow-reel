# 004: Three helpers support verification without duplicating the recorder

**Date:** 2026-11-13 (requested: "scripts and references and evrything needed"; implementation choice within the user's delegated approval)

**Decision:** plan three Node standard-library helpers: `preflight.mjs`, `inspect-recording.mjs`, and `snapshot-take.mjs`. Their contracts, exit codes, fixtures and tests are detailed in `skill-suite.md` and `impl.md`.

Use the installed, version-selected `flow-reel compare` command for transcript schema/sync checking instead of duplicating private validators. Comparing a transcript with itself checks those semantics; it is never described as reproducibility proof. Artifact inspection additionally opens referenced files and checks bytes/metadata. Two separate takes on the same platform are required for a reproducibility claim. Human playback is required for a claim about perceptual narration or visual quality.

Helpers do not install packages, start an app, seed/reset app data, alter engine configuration, or silently build an image. They report actionable missing prerequisites. Agent instructions can carry out necessary setup within the user's authorization. Browser exploration uses available tools; no specific MCP installation is mandatory.

- **Why:** the repeatable failure-prone mechanics deserve scripts; editorial judgment, app exploration and narration do not benefit from a bespoke framework.

# 006: Expose transcript comparison as a host command

**Date:** 2026-11-11 (ticket pass, Q6; agreed: "ok")

**Question:** let users compare their own recordings from the CLI, or keep comparison inside tests?

**Decision:** **add `flow-reel compare a.json b.json`, running on the host without Docker.** Read the two
transcripts, check their schema and sync, and compare step order, original narration, voice identity, audio hashes
and step starts within the inherited 150 ms tolerance. Report differences and return a nonzero exit status for a
failed check. Reuse the same checks in tests. Recording also automatically checks that narration fits its steps.

This is a narrow exception to story decision 008's host-only-launcher rule: the read-only comparison command
processes local JSON on the host. Recording, browser capture, TTS and rendering continue inside the image.

- **Why:** users and CI can verify their own saved runs without downloading or starting the recording image.
- **Not chosen:** a test-only comparison helper, which gives users no direct way to check their recordings.
- **Boundary:** comparison uses transcript data, as required by story decision 009. Exact exit codes, diagnostics
  and validation details are specified in the implementation plan; file paths alone must not count as audio changes.

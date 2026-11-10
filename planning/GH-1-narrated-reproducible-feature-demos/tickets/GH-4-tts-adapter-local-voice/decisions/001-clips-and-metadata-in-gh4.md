# 001: GH-4 generates clips and writes their metadata during recording

**Date:** 2026-11-10 (ticket pass, Q1; agreed: "ok")

**Question:** does GH-4 integrate synthesis and metadata into `flow-reel record`, or leave integration to GH-5?

**Decision:** **GH-4 generates WAV clips and writes `voice` and each narrated step's `audio` metadata during
`flow-reel record`.** Synthesis happens after capture so it does not compete with the real-time recorder. The MP4
stays silent and step timing is unchanged. GH-5 owns holds and muxing, and may move synthesis earlier as needed.

This supersedes story decision 011 only in assigning the `voice` and `audio` fields to GH-4 rather than GH-5.
The version 1 schema stays the same.

- **Why:** an end-to-end recording produces usable clips and their durations and hashes for GH-5.
- **Not chosen:** shipping only an adapter with a separate synthesis test, leaving recording integration and
  metadata to GH-5.

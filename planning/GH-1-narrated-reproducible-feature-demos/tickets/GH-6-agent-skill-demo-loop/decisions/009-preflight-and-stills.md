# 009: Two helpers: `preflight.mjs` and `stills.mjs`

**Supersedes 004** for the helper set. Still standing from 004: Node standard library only, no installing, starting
or changing anything, exit codes 0 / 1 / 2, and playback by a person for any claim about perceived quality.

**Date:** 2026-11-15 (re-plan for 0.2, Q4; agreed: "ok")

**Question:** 0.2's `flow-reel verify` checks a reel's files and hashes, `compare` checks transcripts and sync, and a
compose keeps the old reel until the new one succeeds. Which planned helpers still earn their place?

**Decision:** **two helpers in `plugin/scripts/`:**

- **`preflight.mjs`:** Node, Docker or Podman and its daemon, the composer image for the chosen version, the app's
  URL answering, and the runtime version within the range in `language.md`. It reports what is missing and the
  command that would fix it; it changes nothing.
- **`stills.mjs`:** frames from a reel's `video.mp4` at each step's start and end (from `transcript.json`), and a
  contact sheet of them, so an agent can look at framing, zooms and payoffs. It also reports the video's streams
  and duration. It runs the ffmpeg already in the composer image (`--entrypoint`, the reel mounted read-only) or the
  host's, writes only to a folder it is given, and never pulls or builds an image.

`inspect-recording.mjs` and `snapshot-take.mjs` are dropped: verify and compare do the first's checks, and keeping a
"before" reel for a reshoot is a folder copy followed by `flow-reel verify`.

- **Why:** the helpers would otherwise repeat the CLI; what an agent lacks is seeing the reel.
- **Not chosen:** three renamed helpers (they repeat verify and compare, and still show nothing); preflight only
  (screening by metadata).

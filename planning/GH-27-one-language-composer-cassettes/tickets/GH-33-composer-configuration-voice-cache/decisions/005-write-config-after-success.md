# 005: `flow-reel.json` is written only after a successful compose

**Superseded by GH-108 001** in part (2026-11-25): `init` writes the file. `--save-config` still waits for success.

**Date:** 2026-11-14 (ticket pass, Q5; agreed: "ok")

**Question:** when does `compose` write `flow-reel.json` (the first time, or with `--save-config`)?

**Decision:** **after the container exits with 0.** The host writes the settings of that run; a failed compose
writes nothing, so the file only ever holds settings that composed a reel.

- **Why:** the file stays trustworthy, and it is still "run the CLI and the settings are written" (decision 001).
- **Not chosen:** writing before the container starts (a failed first run leaves a file); `--save-config` as a
  separate command that doesn't compose (not what decision 001 describes).

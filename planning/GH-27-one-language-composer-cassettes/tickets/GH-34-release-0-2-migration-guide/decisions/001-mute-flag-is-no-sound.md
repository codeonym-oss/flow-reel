# 001: The mute flag is `--no-sound`, renamed before 0.2.0 ships

**Date:** 2026-11-15 (ticket pass, Q1; agreed: "yes")

**Question:** the 0.2 vocabulary avoids "SFX" (story decisions 009, 010), but the mute flag is still `--no-sfx` and
the work folder holds `sfx.wav`. Rename them before the release?

**Decision:** **rename them in this ticket.** `--no-sfx` becomes `--no-sound`; `work/sfx.wav` becomes
`work/sound.wav`. No alias for the old flag (story decision 008); the migration table gets a row for it.

- **Why:** 0.2.0 is the one breaking release; renaming after it would be another break, and the shipped CLI would
  otherwise keep an avoided word.
- **Not chosen:** keeping `--no-sfx` as a CONTEXT.md exception (an avoided word in the CLI for good); a separate
  ticket before the release (the same work, plus an issue and a pull request).

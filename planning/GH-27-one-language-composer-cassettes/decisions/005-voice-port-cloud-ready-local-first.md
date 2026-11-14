# 005: The voice port supports cached cloud voices; only local voices ship at first

**Date:** 2026-11-14 (shaping, Q4; agreed: "we will build it to support 1, but we will only use the local models as
starter (they both use same interface for the Port)")

**Question:** how does a configurable voice (local or cloud, with API keys) stay compatible with a deterministic
compile?

**Decision:** **one voice port for local and cloud voices, designed so cloud clips are cached in the cassette and
reused on recompile; only local voices are shipped to start.** With a cache, the promise is "same script and same
cassette cache, same result"; only a changed comment is synthesized again.

- **Terms:** the configurable model is the **voice** (speech synthesis). The **transcript** is the timed text the
  composer writes. Nothing transcribes audio to text.
- **Why:** determinism holds for any voice, and unchanged lines are never billed twice; shipping local first keeps
  the first delivery small while the port already has the right shape.
- **Not chosen:** cloud as best effort without a cache (the determinism promise gets an exception); a local-only
  port (would need reshaping when cloud arrives).
- **Keeps:** GH-1 decision 004 (pluggable TTS, local by default).

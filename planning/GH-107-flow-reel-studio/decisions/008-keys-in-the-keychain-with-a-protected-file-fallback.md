# 008: API keys live in the system keychain, with a protected file as the fallback

**Date:** 2026-11-25 (grilling; agreed: "id pick B + fallback to A! with some modifs")

**Question:** where do API keys live?

**Decision:** **in the system keychain; where there is none, in a separate credentials file only the person can read
(chmod 600 on Linux).** A key is either global or local to a workspace, and its name carries the scope through a prefix
such as `FLOW_REEL__GLOBAL__<X>` or `FLOW_REEL__<WORKSPACE>__<X>`, set up with a command. Keys never go in
`flow-reel.json`.

- **Why:** two workspaces can hold different values for a name such as `OPENAI_API_KEY`.
- **Open:** the same protection on Windows and macOS, the lookup order, and whether an unprefixed name counts.

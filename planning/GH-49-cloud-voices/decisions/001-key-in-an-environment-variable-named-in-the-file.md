# 001: The key is in an environment variable that the file names

**Date:** 2026-11-15 (asked: "the config file to specify the provider and the modelID and the API KEY"; chose "Env
var, named in file")

**Supersedes GH-33 004** in part: a cloud voice's file and flags may name the variable (`voice.apiKeyEnv`,
`--api-key-env`). Everything else in GH-33 004 stands: the host checks the variable is set before the container
starts, and passes it as `-e NAME`.

**Decision:** each cloud voice has a default variable (`OPENAI_API_KEY`, `GEMINI_API_KEY`, ...); `apiKeyEnv`
overrides it. `apiKey` in `flow-reel.json` is refused with a message saying where the key goes. `apiKeyEnv` must look
like a variable name, so a key pasted there fails instead of being passed on.

- **Why:** `flow-reel.json` sits beside the scripts and is committed; a key in it leaks.
- **Not chosen:** a literal key in the file (leaks with the file); both forms (the unsafe one would be copied from
  examples).

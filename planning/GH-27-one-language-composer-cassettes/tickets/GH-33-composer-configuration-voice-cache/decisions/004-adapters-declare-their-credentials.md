# 004: Each adapter declares the environment variables it needs

**Date:** 2026-11-14 (ticket pass, Q4; agreed: "ok")

**Supersedes 001** for credentials only: the file and the flags name no environment variables. The rest of 001
stands.

**Question:** how do credentials reach the container?

**Decision:** **an adapter declares its credentials by variable name** (`credentials: ["NAME"]`). When it is
selected, the host checks each is set, fails before starting the container when one is not ("voice x needs NAME"),
and passes it as `-e NAME`, so the engine reads the value from the host's environment and it never appears on a
command line or in a file. No other variable is passed. No shipped adapter declares any; a fake adapter in the tests
proves that a credential's value is in none of the reel's files, the manifest, the run arguments or the output.

- **Why:** nothing for users to list; a clear error before the composer starts; only what an adapter needs crosses
  into the container.
- **Not chosen:** a user-listed `env` in `flow-reel.json` and `--env` flags (users must know the names, a missing one
  fails late inside the container, and anything listed is passed).

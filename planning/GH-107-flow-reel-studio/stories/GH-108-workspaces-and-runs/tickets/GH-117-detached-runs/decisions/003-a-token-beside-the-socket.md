# 003: Each command carries a token from the run's folder

**Date:** 2026-11-25 (chosen alone, story decision 013)

**Decision:** **the run's folder holds the socket's address and a random token, in a file only the person can read; the process
refuses a command without it. On Unix the socket is in a folder only the person can open, in `XDG_RUNTIME_DIR` or the
temporary folder, because a socket's path can't be longer than about 100 bytes.**

- **Why:** what a named pipe allows on Windows depends on the account; the token is the same rule on the three systems.

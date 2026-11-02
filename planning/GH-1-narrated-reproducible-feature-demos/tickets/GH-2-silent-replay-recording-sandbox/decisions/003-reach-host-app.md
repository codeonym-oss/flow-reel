# 003: The container reaches the host's app per platform, with the script's URL unchanged

**Date:** 2026-11-02 (ticket pass, Q5; agreed: "ok")

**Question:** how does the browser inside the container reach an app on the host's `localhost`?

**Decision:** **Linux: `--network host`**, so apps bound to `127.0.0.1` work as is. **Docker Desktop (macOS,
Windows/WSL2): Chromium starts with `--host-resolver-rules="MAP localhost host.docker.internal"`**, which Docker
Desktop forwards to the host's loopback. The script keeps the URL the agent used while exploring.

- **Why:** default dev-server setups (Vite, Next, bound to 127.0.0.1) work with no change.
- **Not chosen:** always `host.docker.internal` (on Linux the app must bind 0.0.0.0, a confusing first failure);
  running the app inside the container (the image would need every project's runtime).
- **Cost accepted:** two launcher paths; only Linux is tested on this machine.

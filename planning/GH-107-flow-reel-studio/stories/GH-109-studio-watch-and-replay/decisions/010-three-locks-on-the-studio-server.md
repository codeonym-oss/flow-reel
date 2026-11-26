# 010: The studio's server has three locks: this computer, its own origin, and a key

**Date:** 2026-11-26 (grilling, Q8; agreed: "1")

**Question:** how is the studio's server kept safe on this computer?

**Decision:**

1. **It listens on 127.0.0.1 only.**
2. **It refuses any request whose `Host` or `Origin` is not its own address,** which shuts out other sites and DNS
   rebinding.
3. **A key:** `flow-reel studio` opens the browser with a random one-time key in the URL; the browser trades it for a
   cookie, and every request and WebSocket must carry it. Another account or program on the computer can't watch or
   control runs, as for runs themselves (story GH-108).

In every case the server reads files only inside registered workspaces and their runs' folders.

- **Why:** a local server that can start and cancel runs is reachable by every site the browser opens and every account
  on the computer, unless it checks who is asking.
- **Accepted cost:** a studio tab opened without the key (a typed URL, another browser) is refused and must be opened
  from `flow-reel studio` again.
- **Not chosen:** without the key (any program or account could watch or cancel runs); asking again before cancel (the
  mockup already confirms it).

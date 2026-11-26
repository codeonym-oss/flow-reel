# 011: Seven tickets, the server first and the reel last

**Date:** 2026-11-26 (grilling, Q9; agreed: "1")

**Question:** how does the story split into tickets, and in what order do they ship?

**Decision:** **seven tickets, each built and checked on its own:**

1. The server and the shell: `flow-reel studio`, its three locks (010), the shared types (008), the empty app.
2. Workspaces.
3. Scripts.
4. Run, live: the WebSocket, steps, log, journal, failures, phases, cancel and resume; no live picture yet.
5. The live picture (002, 009), with its CPU measured against 0.7.
6. The score (007), shared by Run and Reel.
7. Reel.

- **Why:** each screen ships on the shell; the container change (5) has its own ticket and its own measurement; the score
  is built once, live first, then replayed.
- **Not chosen:** the live picture inside the Run ticket (a container change and a CPU check in a large UI ticket).

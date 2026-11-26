# 002: The live picture is a light second grab of the virtual screen

**Date:** 2026-11-26 (grilling, Q2; agreed: "1")

**Question:** how does the live picture of the app reach the studio?

**Decision:** **the record container grabs its virtual screen a second time, at about 8 small JPEG pictures a second and
low priority, only while someone watches.** The run's process passes them to the studio. Story 3 adds input on the same
picture for the remote screen (epic decision 020).

- **Why:** it shows the whole screen, popups and menus included; story 3 reuses it; nobody watching costs nothing.
- **Accepted cost:** some CPU while recording, measured against 0.7 before it ships (epic gate 4).
- **Not chosen:** Chrome's page screencast (no popups, so story 3 would need another way); VNC in the container (a server,
  a port out of the container and a client, the heaviest); no live picture (the goal asks for one).

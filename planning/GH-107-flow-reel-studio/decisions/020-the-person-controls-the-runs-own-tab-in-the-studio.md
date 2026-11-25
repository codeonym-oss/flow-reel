# 020: While a run is held, the person uses the run's own browser tab inside the studio

**Date:** 2026-11-25 (grilling; agreed: "A, inside the studio as a remote screen and we will fix the clock's bug as well
(somehow)")

**Question:** where does the person act when a run is interrupted?

**Decision:** **in the studio, which shows the runner's virtual screen and sends the person's mouse and keyboard to it.**
It is the same tab, with everything the script already filled; there is no second login. The fixed page clock
(5 January 2026 in every run), which can break logins and payments, is fixed as part of this work.

- **Why:** it shows popups and menus drawn outside the page, and needs only the studio.
- **Not chosen:** the person's own Chrome through its developer tools connection (Chrome only, may miss popups, and opens
  a powerful control port).
- **To check when built:** the delay, popup windows, copy-paste, file upload.
- **Open:** how the clock is fixed; it changes part of GH-1 decision 009, which fixes it on purpose.

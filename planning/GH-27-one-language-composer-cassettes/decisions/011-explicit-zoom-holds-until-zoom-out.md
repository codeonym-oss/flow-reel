# 011: An explicit zoom holds the camera from `zoomIn` until `zoomOut`, across steps

**Date:** 2026-11-14 (GH-32 ticket pass, Q5; agreed: "ok")

**Supersedes 003** for one rule: an explicit zoom no longer takes over the camera "for that step". The rest of 003
stands: automatic polish by default, effect words override, a script setting turns automatic zoom off.

**Question:** when does an explicit zoom own the camera?

**Decision:** **from `zoomIn` until `zoomOut`, whatever steps lie between.**

- While the script holds the camera, automatic zoom is off; before `zoomIn` and after `zoomOut` it runs as usual.
- A `zoomIn` while zoomed pans and zooms to its new target from the current crop, without returning to full first.
- A zoom still held when the script ends eases out with `zoomOut`'s default.
- The pointer stays in frame, as today: the crop moves just enough to keep the cursor visible.
- `autoZoom: false` turns automatic zoom off for the whole script; cursor and click ripple stay.
- The polish planner needs only the event log, not the step spans.

- **Why:** a step ends at every comment, so a step-bound zoom drops out in the middle of explaining one part of the
  screen over several comments; who holds the camera should not depend on where comments fall.
- **Not chosen:** the zoom ends with its step (003 as written: the zoom is repeated at every comment, and the planner
  needs step spans); the zoom applies to the next action only (a script can never hold a shot).

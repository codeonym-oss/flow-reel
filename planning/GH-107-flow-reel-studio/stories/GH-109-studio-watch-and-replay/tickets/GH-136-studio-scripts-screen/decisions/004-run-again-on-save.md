# 004: Run again on save is per script, kept by the studio, and never runs a script twice at once

**Date:** 2026-11-26 (decided alone: the person approved autonomous delivery of story GH-109)

**Question:** how does "Run again on save" behave?

**Decision:**

- A switch per script, off by default, kept by the studio's server while it runs (not on disk): stopping the studio
  turns them all off.
- When on, the server watches the script's file. A save that changes its content starts a run, as **Run** does.
- A save while a run of that script is going waits for it to end; several saves meanwhile make one run.
- The switch explains what it does: every save repeats the script's real actions in the app.

- **Why:** it is easy to forget a switch that survives restarts, and each run acts on the app.

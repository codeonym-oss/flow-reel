# 003: The picture is polished automatically by default; effect words in the script override it

**Date:** 2026-11-14 (shaping, Q2; agreed: "ok")

**Question:** do explicit effects replace today's automatic cursor/ripple/zoom polish, or sit on top of it?

**Decision:** **automatic by default, script words override.** A script with no effect words gets today's cursor,
click ripple, zoom on click and follow. An explicit camera word (zoom in, zoom out) on a step takes over the camera
for that step, and a script-level setting turns automatic zoom off. Flash and `showFrame` are additions with no
automatic counterpart.

- **Why:** a plain script, which is what an agent writes first, still gives a good video; a person who cares about
  one moment can direct it.
- **Not chosen:** explicit only (existing demos lose their zoom; every script directs its own camera); automatic
  cursor and ripple with zoom always explicit (more work per script than today).
- **Keeps:** GH-1 decision 012 (polish rendered in post from the event log).

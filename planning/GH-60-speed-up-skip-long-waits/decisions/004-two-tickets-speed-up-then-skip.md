# 004: One story, two tickets: speed-up (with the retiming), then skip and the release

**Date:** 2026-11-16 (shaping, Q4; the person answered "yes" to option 3)

**Question:** how big is this, how does it split, and what does done look like?

**Decision:** a **story** with two tickets, in this order:
1. **speed-up** with its factor badge, including the timeline retiming it needs (a stretch's length changes, the
   transcript and captions follow);
2. **skip** with its "skipped" card, plus the release (0.4.0) and the plugin teaching both words.

**Done when:** a script that waits about 60 s for a slow reply composes into a reel where the wait plays at the
chosen speed with its badge, or is replaced by the "skipped" card; the comment over it is spoken whole; the transcript
and captions line up; and two composes give the same timeline.

- **Why:** each pull request delivers something visible; the retiming has no visible result on its own, so it is built
  with the first effect that uses it.
- **Rejected:** a separate retiming ticket (nothing to see); one ticket for everything (one large pull request across
  timeline, two effects, docs and plugin).
